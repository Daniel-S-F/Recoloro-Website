/* RECOLORO – interne, nicht öffentliche Bearbeitungsparameter. */
'use strict';

window.RECOLORO_IMAGE_EDITOR_CONFIG = {
  schemaVersion: 1,
  updatedAt: '2026-08-25',
  pairs: {
    'orig-001': {
      sourceOrientation: {
        before: { exifOrientation: 6, orientedWidth: 3472, orientedHeight: 4624 },
        after: { exifOrientation: 6, orientedWidth: 3472, orientedHeight: 4624 },
        normalizedOnDecode: true
      },
      alignment: {
        reference: 'after',
        simple: {
          before: { x: 0, y: 0, scale: 1, rotation: 0 },
          after: { x: 0, y: 0, scale: 1, rotation: 0 }
        },
        perspective: {
          enabled: true,
          pointOrder: ['top-left', 'top-right', 'bottom-right', 'bottom-left'],
          before: [
            { x: 0.147, y: 0.077 },
            { x: 0.573, y: 0.096 },
            { x: 0.537, y: 0.842 },
            { x: 0.147, y: 0.833 }
          ],
          after: [
            { x: 0.208, y: 0.089 },
            { x: 0.650, y: 0.089 },
            { x: 0.622, y: 0.856 },
            { x: 0.232, y: 0.856 }
          ],
          gridSize: 20
        }
      },
      anonymization: {
        masks: [
          {
            id: 'orig-001-house-number',
            label: 'Hausnummer',
            type: 'pixelate',
            scope: 'both',
            x: 0.690,
            y: 0.010,
            width: 0.175,
            height: 0.110,
            color: '#536875',
            pixelSize: 28,
            blurRadius: 28
          },
          {
            id: 'orig-001-mailbox-label',
            label: 'Briefkastenschild',
            type: 'pixelate',
            scope: 'both',
            x: 0.685,
            y: 0.430,
            width: 0.145,
            height: 0.085,
            color: '#687275',
            pixelSize: 24,
            blurRadius: 28
          }
        ]
      },
      workflow: {
        orientationChecked: false,
        alignmentChecked: false,
        anonymizationChecked: false,
        desktopCropChecked: false,
        mobileCropChecked: false,
        exportPreviewChecked: false,
        technicalApproved: true
      }
    }
  }
};
