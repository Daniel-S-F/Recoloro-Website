<?php
declare(strict_types=1);

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');

$wantsJson = str_contains(strtolower($_SERVER['HTTP_ACCEPT'] ?? ''), 'application/json');

function respond(int $status, string $message, bool $wantsJson): never
{
    http_response_code($status);
    if ($wantsJson) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => $status < 400, 'message' => $message], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } else {
        header('Content-Type: text/html; charset=utf-8');
        $safe = htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        echo '<!doctype html><html lang="de-CH"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RECOLORO Anfrage</title><link rel="stylesheet" href="styles.css"><body class="simple-page"><main class="simple-main"><section class="simple-panel"><h1>Offertanfrage</h1><p>' . $safe . '</p><p><a href="index.html#offerte">Zurück zum Formular</a></p></section></main></body></html>';
    }
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(405, 'Diese Adresse akzeptiert ausschliesslich Offertanfragen aus dem Formular.', $wantsJson);
}

if (!empty($_POST['company_website'] ?? '')) {
    respond(200, 'Vielen Dank. Ihre Anfrage wurde übermittelt.', $wantsJson);
}

$started = filter_input(INPUT_POST, 'form_started', FILTER_VALIDATE_INT);
if ($started && (time() - $started < 2 || time() - $started > 7200)) {
    respond(400, 'Bitte laden Sie das Formular neu und versuchen Sie es nochmals.', $wantsJson);
}

$recipient = trim((string) getenv('RECOLORO_LEAD_EMAIL'));
if (!filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
    respond(503, 'Der Anfrageweg ist noch nicht vollständig eingerichtet. Bitte versuchen Sie es später erneut.', $wantsJson);
}

$name = trim((string) ($_POST['name'] ?? ''));
$email = trim((string) ($_POST['email'] ?? ''));
$plz = trim((string) ($_POST['plz'] ?? ''));
$phone = trim((string) ($_POST['phone'] ?? ''));
$notes = trim((string) ($_POST['notes'] ?? ''));
$privacy = (string) ($_POST['privacy_notice'] ?? '');
$components = $_POST['components'] ?? [];

if (!is_array($components)) $components = [];

$allowedComponents = [
    'Tueren und Tore',
    'Fenster und Storen',
    'Fassaden und Bruestungen',
    'Wintergaerten und Metallprofile',
    'Andere beschichtete Metallbauteile',
];
$components = array_values(array_intersect($allowedComponents, array_map('strval', $components)));

if ($name === '' || strlen($name) > 240 || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 180) {
    respond(422, 'Bitte prüfen Sie Name und E-Mail-Adresse.', $wantsJson);
}
if (!preg_match('/^\d{4}$/', $plz) || !$components || $privacy !== 'acknowledged') {
    respond(422, 'Bitte geben Sie eine vierstellige PLZ an, wählen Sie mindestens ein Bauteil und bestätigen Sie die Datenschutzinformation.', $wantsJson);
}
if (strlen($phone) > 80 || strlen($notes) > 4000) {
    respond(422, 'Telefonnummer oder Notizen sind zu lang.', $wantsJson);
}

$attachments = [];
$totalBytes = 0;
$allowedMime = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
$uploads = $_FILES['photos'] ?? null;

if ($uploads && is_array($uploads['name'] ?? null)) {
    $fileCount = count(array_filter($uploads['name'], static fn($name) => $name !== ''));
    if ($fileCount > 3) respond(422, 'Bitte laden Sie höchstens drei Bilder hoch.', $wantsJson);

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    foreach ($uploads['name'] as $index => $originalName) {
        if ($originalName === '') continue;
        $error = (int) ($uploads['error'][$index] ?? UPLOAD_ERR_NO_FILE);
        $size = (int) ($uploads['size'][$index] ?? 0);
        $tmpName = (string) ($uploads['tmp_name'][$index] ?? '');
        if ($error !== UPLOAD_ERR_OK || $size <= 0 || $size > 5 * 1024 * 1024 || !is_uploaded_file($tmpName)) {
            respond(422, 'Mindestens ein Bild konnte nicht verarbeitet werden oder ist grösser als 5 MB.', $wantsJson);
        }
        $totalBytes += $size;
        if ($totalBytes > 10 * 1024 * 1024) respond(422, 'Die Bilder dürfen zusammen maximal 10 MB gross sein.', $wantsJson);
        $mime = $finfo->file($tmpName) ?: '';
        if (!isset($allowedMime[$mime])) respond(422, 'Erlaubt sind ausschliesslich JPG-, PNG- und WebP-Bilder.', $wantsJson);
        $attachments[] = [
            'path' => $tmpName,
            'mime' => $mime,
            'name' => 'recoloro-anfrage-' . ($index + 1) . '.' . $allowedMime[$mime],
        ];
    }
}

$safeLine = static fn(string $value): string => preg_replace('/[\r\n]+/', ' ', $value) ?? '';
$body = implode("\n", [
    'Neue Offertanfrage über recoloro.ch',
    '',
    'Name: ' . $safeLine($name),
    'E-Mail: ' . $safeLine($email),
    'Telefon: ' . ($phone !== '' ? $safeLine($phone) : 'nicht angegeben'),
    'Objekt-PLZ: ' . $plz,
    'Bauteile: ' . implode(', ', $components),
    '',
    'Notizen:',
    $notes !== '' ? $notes : 'keine',
    '',
    'Datenschutzinformation zur Kenntnis genommen: ja',
    'Eingang: ' . date('c'),
]);

$from = trim((string) getenv('RECOLORO_FROM_EMAIL'));
if (!filter_var($from, FILTER_VALIDATE_EMAIL)) $from = 'no-reply@recoloro.ch';
$subjectText = 'RECOLORO Offertanfrage ' . $plz . ' – ' . $name;
$subject = function_exists('mb_encode_mimeheader') ? mb_encode_mimeheader($subjectText, 'UTF-8') : $subjectText;
$headers = [
    'From: RECOLORO Website <' . $from . '>',
    'Reply-To: ' . $safeLine($email),
    'MIME-Version: 1.0',
];

if ($attachments) {
    $boundary = '=_recoloro_' . bin2hex(random_bytes(16));
    $headers[] = 'Content-Type: multipart/mixed; boundary="' . $boundary . '"';
    $mailBody = '--' . $boundary . "\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n" . $body . "\r\n";
    foreach ($attachments as $attachment) {
        $content = chunk_split(base64_encode((string) file_get_contents($attachment['path'])));
        $mailBody .= '--' . $boundary . "\r\nContent-Type: " . $attachment['mime'] . '; name="' . $attachment['name'] . "\"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"" . $attachment['name'] . "\"\r\n\r\n" . $content . "\r\n";
    }
    $mailBody .= '--' . $boundary . "--\r\n";
} else {
    $headers[] = 'Content-Type: text/plain; charset=UTF-8';
    $mailBody = $body;
}

$sent = mail($recipient, $subject, $mailBody, implode("\r\n", $headers));
if (!$sent) respond(503, 'Die Anfrage konnte technisch nicht zugestellt werden. Bitte versuchen Sie es später erneut.', $wantsJson);

respond(200, 'Vielen Dank. Ihre Anfrage wurde erfolgreich übermittelt. Wir melden uns nach der Prüfung.', $wantsJson);
