/* RECOLORO – interne, nicht öffentlich auszuliefernde Editor-Konfiguration. */
'use strict';

window.RECOLORO_IMAGE_EDITOR_CONFIG = {
  "schemaVersion": 1,
  "updatedAt": "2026-08-25",
  "pairs": {
    "orig-001": {
      "sourceOrientation": {
        "before": {
          "exifOrientation": 6,
          "orientedWidth": 3472,
          "orientedHeight": 4624
        },
        "after": {
          "exifOrientation": 6,
          "orientedWidth": 3472,
          "orientedHeight": 4624
        },
        "normalizedOnDecode": true
      },
      "alignment": {
        "reference": "after",
        "simple": {
          "before": {
            "x": 0,
            "y": 0,
            "scale": 1,
            "rotation": 0
          },
          "after": {
            "x": 0,
            "y": 0,
            "scale": 1,
            "rotation": 0
          }
        },
        "perspective": {
          "enabled": true,
          "pointOrder": [
            "top-left",
            "top-right",
            "bottom-right",
            "bottom-left"
          ],
          "before": [
            {
              "x": 0.147,
              "y": 0.077
            },
            {
              "x": 0.573,
              "y": 0.096
            },
            {
              "x": 0.537,
              "y": 0.842
            },
            {
              "x": 0.147,
              "y": 0.833
            }
          ],
          "after": [
            {
              "x": 0.208,
              "y": 0.089
            },
            {
              "x": 0.65,
              "y": 0.089
            },
            {
              "x": 0.622,
              "y": 0.856
            },
            {
              "x": 0.232,
              "y": 0.856
            }
          ],
          "gridSize": 20
        }
      },
      "anonymization": {
        "masks": [
          {
            "id": "orig-001-house-number",
            "label": "Hausnummer",
            "type": "pixelate",
            "scope": "both",
            "x": 0.69,
            "y": 0.01,
            "width": 0.12726368520038134,
            "height": 0.08012207308962897,
            "color": "#536875",
            "pixelSize": 28,
            "blurRadius": 28
          },
          {
            "id": "orig-001-mailbox-label",
            "label": "Briefkastenschild",
            "type": "blur",
            "scope": "both",
            "x": 0.702958002493065,
            "y": 0.47063401185988635,
            "width": 0.048618051764704684,
            "height": 0.028146594206024778,
            "color": "#687275",
            "pixelSize": 24,
            "blurRadius": 28
          }
        ]
      },
      "workflow": {
        "orientationChecked": true,
        "alignmentChecked": true,
        "anonymizationChecked": true,
        "desktopCropChecked": true,
        "mobileCropChecked": true,
        "exportPreviewChecked": true,
        "technicalApproved": true
      }
    },
    "reco-105": {
      "sourceOrientation": null,
      "alignment": {
        "reference": "after",
        "simple": {
          "before": {
            "x": 0,
            "y": 0,
            "scale": 1,
            "rotation": 0
          },
          "after": {
            "x": 0,
            "y": 0,
            "scale": 1,
            "rotation": 0
          }
        },
        "perspective": {
          "enabled": false,
          "pointOrder": [
            "top-left",
            "top-right",
            "bottom-right",
            "bottom-left"
          ],
          "before": [
            {
              "x": 0.1,
              "y": 0.1
            },
            {
              "x": 0.9,
              "y": 0.1
            },
            {
              "x": 0.9,
              "y": 0.9
            },
            {
              "x": 0.1,
              "y": 0.9
            }
          ],
          "after": [
            {
              "x": 0.1,
              "y": 0.1
            },
            {
              "x": 0.9,
              "y": 0.1
            },
            {
              "x": 0.9,
              "y": 0.9
            },
            {
              "x": 0.1,
              "y": 0.9
            }
          ],
          "gridSize": 16
        }
      },
      "anonymization": {
        "masks": []
      },
      "workflow": {
        "orientationChecked": true,
        "alignmentChecked": true,
        "anonymizationChecked": true,
        "desktopCropChecked": true,
        "mobileCropChecked": true,
        "exportPreviewChecked": true,
        "technicalApproved": true
      }
    },
    "reco-112": {
      "sourceOrientation": null,
      "alignment": {
        "reference": "after",
        "simple": {
          "before": {
            "x": 0,
            "y": 0,
            "scale": 1,
            "rotation": 0
          },
          "after": {
            "x": 0,
            "y": 0,
            "scale": 1,
            "rotation": 0
          }
        },
        "perspective": {
          "enabled": false,
          "pointOrder": [
            "top-left",
            "top-right",
            "bottom-right",
            "bottom-left"
          ],
          "before": [
            {
              "x": 0.1,
              "y": 0.1
            },
            {
              "x": 0.9,
              "y": 0.1
            },
            {
              "x": 0.9,
              "y": 0.9
            },
            {
              "x": 0.1,
              "y": 0.9
            }
          ],
          "after": [
            {
              "x": 0.1,
              "y": 0.1
            },
            {
              "x": 0.9,
              "y": 0.1
            },
            {
              "x": 0.9,
              "y": 0.9
            },
            {
              "x": 0.1,
              "y": 0.9
            }
          ],
          "gridSize": 16
        }
      },
      "anonymization": {
        "masks": [
          {
            "id": "mask-1787690079339",
            "label": "Neue Maske",
            "type": "blur",
            "scope": "both",
            "x": 0.4243035660009906,
            "y": 0.05383874816308781,
            "width": 0.08695970694682098,
            "height": 0.0996161404131928,
            "color": "#687275",
            "pixelSize": 24,
            "blurRadius": 28
          }
        ]
      },
      "workflow": {
        "orientationChecked": true,
        "alignmentChecked": false,
        "anonymizationChecked": true,
        "desktopCropChecked": true,
        "mobileCropChecked": true,
        "exportPreviewChecked": true,
        "technicalApproved": true
      }
    }
  }
};
