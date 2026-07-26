(function () {
  var canvas = document.getElementById("gym-canvas");
  var stage = canvas.parentElement;
  var context = canvas.getContext("2d");
  var libraryCategories = document.getElementById("library-categories");
  var dragPreview = document.getElementById("drag-preview");
  var stageDropIndicator = document.getElementById("stage-drop-indicator");

  var widthInput = document.getElementById("width-input");
  var lengthInput = document.getElementById("length-input");
  var sizeForm = document.getElementById("size-form");
  var zoomValue = document.getElementById("zoom-value");
  var gymSizeReadout = document.getElementById("gym-size-readout");
  var areaReadout = document.getElementById("area-readout");
  var scaleReadout = document.getElementById("scale-readout");
  var zoomInButton = document.getElementById("zoom-in-button");
  var zoomOutButton = document.getElementById("zoom-out-button");
  var fitButton = document.getElementById("fit-button");
  var resetButton = document.getElementById("reset-button");
  var undoButton = document.getElementById("undo-button");
  var redoButton = document.getElementById("redo-button");
  var copyButton = document.getElementById("copy-button");
  var pasteButton = document.getElementById("paste-button");
  var duplicateButton = document.getElementById("duplicate-button");
  var deleteButton = document.getElementById("delete-button");
  var rotateLeftButton = document.getElementById("rotate-left-button");
  var rotateRightButton = document.getElementById("rotate-right-button");
  var frontButton = document.getElementById("front-button");
  var backButton = document.getElementById("back-button");
  var snapButton = document.getElementById("snap-button");
  var multiSelectButton = document.getElementById("multi-select-button");
  var selectionReadout = document.getElementById("selection-readout");
  var quickButtons = Array.prototype.slice.call(document.querySelectorAll("[data-area]"));

  var MIN_ZOOM = 0.25;
  var MAX_ZOOM = 4;
  var BASE_PIXELS_PER_METER = 64;
  var MAJOR_GRID_METERS = 5;
  var MINOR_GRID_METERS = 1;
  var PADDING = 96;
  var GRID_SNAP_METERS = 0.25;
  var SNAP_THRESHOLD_METERS = 0.22;
  var ALIGN_THRESHOLD_METERS = 0.22;
  var PRODUCT_LIBRARY = [
    {
      id: "custom-gym-fixtures",
      name: "CUSTOM GYM FIXTURES",
      notice: "External custom equipment — final dimensions, price, freight and installation require quotation.",
      items: [
        {
          id: "custom-boxing-muay-thai-ring",
          itemType: "fixture",
          fixtureType: "ring",
          brand: "External custom equipment",
          name: "Custom Boxing / Muay Thai Ring",
          widthMeters: 5,
          depthMeters: 5,
          scaleLabel: "5.00 m × 5.00 m",
          quotationLabel: "Custom quotation required"
        },
        {
          id: "custom-mma-cage-octagon",
          itemType: "fixture",
          fixtureType: "cage",
          brand: "External custom equipment",
          name: "Custom MMA Cage / Octagon",
          widthMeters: 5,
          depthMeters: 5,
          scaleLabel: "Approx. 5.00 m diameter",
          quotationLabel: "Custom quotation required"
        }
      ]
    },
    {
      id: "reference-equipment",
      name: "REFERENCE EQUIPMENT",
      notice: "Generic planning objects only. These are not Athletonic catalog products.",
      items: [
        {
          id: "reference-standard-heavy-bag",
          itemType: "fixture",
          fixtureType: "standard-heavy-bag",
          referenceEquipment: true,
          group: "Heavy Bags",
          brand: "Reference Equipment",
          name: "Standard Heavy Bag",
          widthMeters: 0.45,
          depthMeters: 0.45,
          scaleLabel: "0.45 m × 0.45 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-banana-bag",
          itemType: "fixture",
          fixtureType: "banana-bag",
          referenceEquipment: true,
          group: "Heavy Bags",
          brand: "Reference Equipment",
          name: "Banana Bag",
          widthMeters: 0.5,
          depthMeters: 0.5,
          scaleLabel: "0.50 m × 0.50 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-teardrop-bag",
          itemType: "fixture",
          fixtureType: "teardrop-bag",
          referenceEquipment: true,
          group: "Heavy Bags",
          brand: "Reference Equipment",
          name: "Teardrop Bag",
          widthMeters: 0.65,
          depthMeters: 0.65,
          scaleLabel: "0.65 m × 0.65 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-uppercut-bag",
          itemType: "fixture",
          fixtureType: "uppercut-bag",
          referenceEquipment: true,
          group: "Heavy Bags",
          brand: "Reference Equipment",
          name: "Uppercut Bag",
          widthMeters: 0.75,
          depthMeters: 0.75,
          scaleLabel: "0.75 m × 0.75 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-wrecking-ball-bag",
          itemType: "fixture",
          fixtureType: "wrecking-ball-bag",
          referenceEquipment: true,
          group: "Heavy Bags",
          brand: "Reference Equipment",
          name: "Wrecking Ball Bag",
          widthMeters: 0.9,
          depthMeters: 0.9,
          scaleLabel: "0.90 m × 0.90 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-horizontal-heavy-bag",
          itemType: "fixture",
          fixtureType: "horizontal-heavy-bag",
          referenceEquipment: true,
          group: "Heavy Bags",
          brand: "Reference Equipment",
          name: "Horizontal Heavy Bag",
          widthMeters: 1.8,
          depthMeters: 0.55,
          scaleLabel: "1.80 m × 0.55 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-wall-mounted-uppercut-bag",
          itemType: "fixture",
          fixtureType: "wall-mounted-uppercut-bag",
          referenceEquipment: true,
          group: "Heavy Bags",
          brand: "Reference Equipment",
          name: "Wall Mounted Uppercut Bag",
          widthMeters: 1,
          depthMeters: 0.65,
          scaleLabel: "1.00 m × 0.65 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-human-training-dummy",
          itemType: "fixture",
          fixtureType: "human-training-dummy",
          referenceEquipment: true,
          group: "Heavy Bags",
          brand: "Reference Equipment",
          name: "Human Training Dummy",
          widthMeters: 0.65,
          depthMeters: 0.65,
          scaleLabel: "0.65 m × 0.65 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-speed-ball",
          itemType: "fixture",
          fixtureType: "speed-ball",
          referenceEquipment: true,
          group: "Speed Equipment",
          brand: "Reference Equipment",
          name: "Speed Ball",
          widthMeters: 0.3,
          depthMeters: 0.3,
          scaleLabel: "0.30 m × 0.30 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-double-end-bag",
          itemType: "fixture",
          fixtureType: "double-end-bag",
          referenceEquipment: true,
          group: "Speed Equipment",
          brand: "Reference Equipment",
          name: "Double End Bag",
          widthMeters: 0.32,
          depthMeters: 0.32,
          scaleLabel: "0.32 m × 0.32 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-floor-to-ceiling-ball",
          itemType: "fixture",
          fixtureType: "floor-to-ceiling-ball",
          referenceEquipment: true,
          group: "Speed Equipment",
          brand: "Reference Equipment",
          name: "Floor to Ceiling Ball",
          widthMeters: 0.35,
          depthMeters: 0.35,
          scaleLabel: "0.35 m × 0.35 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-speed-ball-wooden-platform",
          itemType: "fixture",
          fixtureType: "speed-ball-wooden-platform",
          referenceEquipment: true,
          group: "Speed Equipment",
          brand: "Reference Equipment",
          name: "Speed Ball with Wooden Platform",
          widthMeters: 0.9,
          depthMeters: 0.75,
          scaleLabel: "0.90 m × 0.75 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-thai-pad-rack",
          itemType: "fixture",
          fixtureType: "thai-pad-rack",
          referenceEquipment: true,
          group: "STORAGE & TRAINING ACCESSORIES",
          brand: "Reference Equipment",
          name: "Thai Pad Rack",
          widthMeters: 1.2,
          depthMeters: 0.45,
          scaleLabel: "1.20 m × 0.45 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-punch-mitt-rack",
          itemType: "fixture",
          fixtureType: "punch-mitt-rack",
          referenceEquipment: true,
          group: "STORAGE & TRAINING ACCESSORIES",
          brand: "Reference Equipment",
          name: "Punch Mitt Rack",
          widthMeters: 1,
          depthMeters: 0.4,
          scaleLabel: "1.00 m × 0.40 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-kick-shield-rack",
          itemType: "fixture",
          fixtureType: "kick-shield-rack",
          referenceEquipment: true,
          group: "STORAGE & TRAINING ACCESSORIES",
          brand: "Reference Equipment",
          name: "Kick Shield Rack",
          widthMeters: 1.4,
          depthMeters: 0.55,
          scaleLabel: "1.40 m × 0.55 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-belly-pad-storage",
          itemType: "fixture",
          fixtureType: "belly-pad-storage",
          referenceEquipment: true,
          group: "STORAGE & TRAINING ACCESSORIES",
          brand: "Reference Equipment",
          name: "Belly Pad Storage",
          widthMeters: 1.2,
          depthMeters: 0.55,
          scaleLabel: "1.20 m × 0.55 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-glove-storage-shelves",
          itemType: "fixture",
          fixtureType: "glove-storage-shelves",
          referenceEquipment: true,
          group: "STORAGE & TRAINING ACCESSORIES",
          brand: "Reference Equipment",
          name: "Glove Storage Shelves",
          widthMeters: 1.5,
          depthMeters: 0.5,
          scaleLabel: "1.50 m × 0.50 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-headgear-storage",
          itemType: "fixture",
          fixtureType: "headgear-storage",
          referenceEquipment: true,
          group: "STORAGE & TRAINING ACCESSORIES",
          brand: "Reference Equipment",
          name: "Headgear Storage",
          widthMeters: 1.2,
          depthMeters: 0.5,
          scaleLabel: "1.20 m × 0.50 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-general-equipment-shelving",
          itemType: "fixture",
          fixtureType: "general-equipment-shelving",
          referenceEquipment: true,
          group: "STORAGE & TRAINING ACCESSORIES",
          brand: "Reference Equipment",
          name: "General Equipment Shelving",
          widthMeters: 1.8,
          depthMeters: 0.6,
          scaleLabel: "1.80 m × 0.60 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-mobile-equipment-cart",
          itemType: "fixture",
          fixtureType: "mobile-equipment-cart",
          referenceEquipment: true,
          group: "STORAGE & TRAINING ACCESSORIES",
          brand: "Reference Equipment",
          name: "Mobile Equipment Cart",
          widthMeters: 1.1,
          depthMeters: 0.65,
          scaleLabel: "1.10 m × 0.65 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-open-storage-cabinet",
          itemType: "fixture",
          fixtureType: "open-storage-cabinet",
          referenceEquipment: true,
          group: "STORAGE & TRAINING ACCESSORIES",
          brand: "Reference Equipment",
          name: "Open Storage Cabinet",
          widthMeters: 1.2,
          depthMeters: 0.6,
          scaleLabel: "1.20 m × 0.60 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-closed-storage-cabinet",
          itemType: "fixture",
          fixtureType: "closed-storage-cabinet",
          referenceEquipment: true,
          group: "STORAGE & TRAINING ACCESSORIES",
          brand: "Reference Equipment",
          name: "Closed Storage Cabinet",
          widthMeters: 1.2,
          depthMeters: 0.6,
          scaleLabel: "1.20 m × 0.60 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-wall-pad-rack",
          itemType: "fixture",
          fixtureType: "wall-pad-rack",
          referenceEquipment: true,
          group: "STORAGE & TRAINING ACCESSORIES",
          brand: "Reference Equipment",
          name: "Wall Pad Rack",
          widthMeters: 1.5,
          depthMeters: 0.45,
          scaleLabel: "1.50 m × 0.45 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-equipment-storage-zone",
          itemType: "fixture",
          fixtureType: "equipment-storage-zone",
          referenceEquipment: true,
          editableStorageZone: true,
          group: "STORAGE & TRAINING ACCESSORIES",
          brand: "Reference Equipment",
          name: "Pads Storage",
          widthMeters: 2,
          depthMeters: 1.5,
          scaleLabel: "2.00 m × 1.50 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-bench",
          itemType: "fixture",
          fixtureType: "facility-bench",
          referenceEquipment: true,
          group: "FACILITIES & FURNITURE",
          brand: "Reference Equipment",
          name: "Bench",
          widthMeters: 1.5,
          depthMeters: 0.5,
          scaleLabel: "1.50 m × 0.50 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-chair",
          itemType: "fixture",
          fixtureType: "facility-chair",
          referenceEquipment: true,
          group: "FACILITIES & FURNITURE",
          brand: "Reference Equipment",
          name: "Chair",
          widthMeters: 0.55,
          depthMeters: 0.55,
          scaleLabel: "0.55 m × 0.55 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-desk",
          itemType: "fixture",
          fixtureType: "facility-desk",
          referenceEquipment: true,
          group: "FACILITIES & FURNITURE",
          brand: "Reference Equipment",
          name: "Desk",
          widthMeters: 1.4,
          depthMeters: 0.7,
          scaleLabel: "1.40 m × 0.70 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-reception-counter",
          itemType: "fixture",
          fixtureType: "facility-reception-counter",
          referenceEquipment: true,
          group: "FACILITIES & FURNITURE",
          brand: "Reference Equipment",
          name: "Reception Counter",
          widthMeters: 2.4,
          depthMeters: 0.8,
          scaleLabel: "2.40 m × 0.80 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-locker",
          itemType: "fixture",
          fixtureType: "facility-locker",
          referenceEquipment: true,
          group: "FACILITIES & FURNITURE",
          brand: "Reference Equipment",
          name: "Locker",
          widthMeters: 0.5,
          depthMeters: 0.55,
          scaleLabel: "0.50 m × 0.55 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-open-shelving",
          itemType: "fixture",
          fixtureType: "facility-open-shelving",
          referenceEquipment: true,
          group: "FACILITIES & FURNITURE",
          brand: "Reference Equipment",
          name: "Open Shelving",
          widthMeters: 1.5,
          depthMeters: 0.45,
          scaleLabel: "1.50 m × 0.45 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-water-station",
          itemType: "fixture",
          fixtureType: "facility-water-station",
          referenceEquipment: true,
          group: "FACILITIES & FURNITURE",
          brand: "Reference Equipment",
          name: "Water Station",
          widthMeters: 0.8,
          depthMeters: 0.6,
          scaleLabel: "0.80 m × 0.60 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-mirror",
          itemType: "fixture",
          fixtureType: "facility-mirror",
          referenceEquipment: true,
          group: "FACILITIES & FURNITURE",
          brand: "Reference Equipment",
          name: "Mirror",
          widthMeters: 1.8,
          depthMeters: 0.12,
          scaleLabel: "1.80 m × 0.12 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-training-screen",
          itemType: "fixture",
          fixtureType: "facility-training-screen",
          referenceEquipment: true,
          group: "FACILITIES & FURNITURE",
          brand: "Reference Equipment",
          name: "Television / Training Screen",
          widthMeters: 1.4,
          depthMeters: 0.18,
          scaleLabel: "1.40 m × 0.18 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-fan",
          itemType: "fixture",
          fixtureType: "facility-fan",
          referenceEquipment: true,
          group: "FACILITIES & FURNITURE",
          brand: "Reference Equipment",
          name: "Fan",
          widthMeters: 0.6,
          depthMeters: 0.6,
          scaleLabel: "0.60 m × 0.60 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-air-conditioning-unit",
          itemType: "fixture",
          fixtureType: "facility-air-conditioning",
          referenceEquipment: true,
          group: "FACILITIES & FURNITURE",
          brand: "Reference Equipment",
          name: "Air-Conditioning Unit",
          widthMeters: 1.1,
          depthMeters: 0.35,
          scaleLabel: "1.10 m × 0.35 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-trash-bin",
          itemType: "fixture",
          fixtureType: "facility-trash-bin",
          referenceEquipment: true,
          group: "FACILITIES & FURNITURE",
          brand: "Reference Equipment",
          name: "Trash Bin",
          widthMeters: 0.45,
          depthMeters: 0.45,
          scaleLabel: "0.45 m × 0.45 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-reception-area",
          itemType: "fixture",
          fixtureType: "gym-area",
          referenceEquipment: true,
          editableGymArea: true,
          group: "GYM AREAS",
          brand: "Reference Equipment",
          name: "Reception Area",
          visibleText: "Reception Area",
          widthMeters: 3,
          depthMeters: 2.5,
          scaleLabel: "3.00 m × 2.50 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-waiting-area",
          itemType: "fixture",
          fixtureType: "gym-area",
          referenceEquipment: true,
          editableGymArea: true,
          group: "GYM AREAS",
          brand: "Reference Equipment",
          name: "Waiting Area",
          visibleText: "Waiting Area",
          widthMeters: 3,
          depthMeters: 2,
          scaleLabel: "3.00 m × 2.00 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-warm-up-area",
          itemType: "fixture",
          fixtureType: "gym-area",
          referenceEquipment: true,
          editableGymArea: true,
          group: "GYM AREAS",
          brand: "Reference Equipment",
          name: "Warm-Up Area",
          visibleText: "Warm-Up Area",
          widthMeters: 4,
          depthMeters: 3,
          scaleLabel: "4.00 m × 3.00 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-stretching-area",
          itemType: "fixture",
          fixtureType: "gym-area",
          referenceEquipment: true,
          editableGymArea: true,
          group: "GYM AREAS",
          brand: "Reference Equipment",
          name: "Stretching Area",
          visibleText: "Stretching Area",
          widthMeters: 4,
          depthMeters: 3,
          scaleLabel: "4.00 m × 3.00 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-strength-conditioning-area",
          itemType: "fixture",
          fixtureType: "gym-area",
          referenceEquipment: true,
          editableGymArea: true,
          group: "GYM AREAS",
          brand: "Reference Equipment",
          name: "Strength and Conditioning Area",
          visibleText: "Strength and Conditioning Area",
          widthMeters: 5,
          depthMeters: 4,
          scaleLabel: "5.00 m × 4.00 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-trainer-work-area",
          itemType: "fixture",
          fixtureType: "gym-area",
          referenceEquipment: true,
          editableGymArea: true,
          group: "GYM AREAS",
          brand: "Reference Equipment",
          name: "Trainer Work Area",
          visibleText: "Trainer Work Area",
          widthMeters: 3,
          depthMeters: 2,
          scaleLabel: "3.00 m × 2.00 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-changing-room-zone",
          itemType: "fixture",
          fixtureType: "gym-area",
          referenceEquipment: true,
          editableGymArea: true,
          group: "GYM AREAS",
          brand: "Reference Equipment",
          name: "Changing Room Zone",
          visibleText: "Changing Room Zone",
          widthMeters: 4,
          depthMeters: 3,
          scaleLabel: "4.00 m × 3.00 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-shower-zone",
          itemType: "fixture",
          fixtureType: "gym-area",
          referenceEquipment: true,
          editableGymArea: true,
          group: "GYM AREAS",
          brand: "Reference Equipment",
          name: "Shower Zone",
          visibleText: "Shower Zone",
          widthMeters: 2,
          depthMeters: 2,
          scaleLabel: "2.00 m × 2.00 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-bathroom-zone",
          itemType: "fixture",
          fixtureType: "gym-area",
          referenceEquipment: true,
          editableGymArea: true,
          group: "GYM AREAS",
          brand: "Reference Equipment",
          name: "Bathroom Zone",
          visibleText: "Bathroom Zone",
          widthMeters: 2.5,
          depthMeters: 2,
          scaleLabel: "2.50 m × 2.00 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-tatami-area",
          itemType: "fixture",
          fixtureType: "gym-area",
          referenceEquipment: true,
          editableGymArea: true,
          group: "GYM AREAS",
          brand: "Reference Equipment",
          name: "Tatami Area",
          visibleText: "Tatami Area",
          widthMeters: 6,
          depthMeters: 6,
          scaleLabel: "6.00 m × 6.00 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-trainer-position",
          itemType: "fixture",
          fixtureType: "person-trainer",
          referenceEquipment: true,
          group: "PEOPLE & MASCOTS",
          brand: "Reference Equipment",
          name: "Trainer Position",
          widthMeters: 0.65,
          depthMeters: 0.65,
          scaleLabel: "0.65 m × 0.65 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-athlete-position",
          itemType: "fixture",
          fixtureType: "person-athlete",
          referenceEquipment: true,
          group: "PEOPLE & MASCOTS",
          brand: "Reference Equipment",
          name: "Athlete Position",
          widthMeters: 0.65,
          depthMeters: 0.65,
          scaleLabel: "0.65 m × 0.65 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-group-athletes",
          itemType: "fixture",
          fixtureType: "people-group",
          referenceEquipment: true,
          group: "PEOPLE & MASCOTS",
          brand: "Reference Equipment",
          name: "Group of Athletes",
          widthMeters: 2,
          depthMeters: 1.5,
          scaleLabel: "2.00 m × 1.50 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-gym-dog",
          itemType: "fixture",
          fixtureType: "mascot-dog",
          referenceEquipment: true,
          group: "PEOPLE & MASCOTS",
          brand: "Reference Equipment",
          name: "Gym Dog",
          widthMeters: 0.8,
          depthMeters: 0.45,
          scaleLabel: "0.80 m × 0.45 m",
          quotationLabel: "Custom quotation required."
        },
        {
          id: "reference-gym-cat",
          itemType: "fixture",
          fixtureType: "mascot-cat",
          referenceEquipment: true,
          group: "PEOPLE & MASCOTS",
          brand: "Reference Equipment",
          name: "Gym Cat",
          widthMeters: 0.5,
          depthMeters: 0.35,
          scaleLabel: "0.50 m × 0.35 m",
          quotationLabel: "Custom quotation required."
        }
      ]
    },
    {
      id: "heavy-bags",
      name: "Heavy Bags",
      items: [
        {
          id: "official-boon-hblnm",
          brand: "Boon",
          name: "HBLNM Heavy Bag Leather/Nylon 4' (1.2m)",
          image: "https://cdn.shopify.com/s/files/1/2247/2949/products/HBLNM.jpg?v=1660548191",
          url: "/product/boon-hblnm",
          widthMeters: 0.45,
          depthMeters: 0.45,
          heightMeters: 1.2,
          scaleLabel: "0.45 m × 0.45 m"
        },
        {
          id: "official-boon-hbmcxl",
          brand: "Boon",
          name: "HBMCXL Heavy Bag 6ft (1.8m)",
          image: "https://cdn.shopify.com/s/files/1/2247/2949/products/HBLFXL_8d33116d-7741-484f-890f-6ba5253e0dfd.jpg?v=1660548614",
          url: "/product/boon-hbmcxl",
          widthMeters: 0.5,
          depthMeters: 0.5,
          heightMeters: 1.8,
          scaleLabel: "0.50 m × 0.50 m"
        }
      ]
    },
    {
      id: "banana-bags",
      name: "Banana Bags",
      items: [
        {
          id: "official-fairtex-hb6-black-copy",
          brand: "Fairtex",
          name: "Fairtex Heavy Bag HB6 Black Sandbag 6ft Muay Thai Banana",
          image: "https://cdn.shopify.com/s/files/1/0094/9963/9868/files/fairtex-heavy-bag-sandbag-6ft-muay-thai-banana-hb6-black-103808.jpg?v=1737198953",
          url: "/product/fairtex-hb6-black-copy",
          widthMeters: 0.5,
          depthMeters: 0.5,
          heightMeters: 1.8,
          scaleLabel: "0.50 m × 0.50 m"
        }
      ]
    },
    { id: "wall-bags", name: "Wall Bags", items: [] },
    {
      id: "uppercut-bags",
      name: "Uppercut Bags",
      items: [
        {
          id: "official-boon-tdbm",
          brand: "Boon",
          name: "TDBM Tear Drop Bag",
          image: "https://cdn.shopify.com/s/files/1/2247/2949/products/TDB.jpg?v=1583112660",
          url: "/product/boon-tdbm",
          widthMeters: 0.62,
          depthMeters: 0.62,
          heightMeters: 0.9,
          scaleLabel: "0.62 m × 0.62 m"
        }
      ]
    },
    { id: "speed-bags", name: "Speed Bags", items: [] },
    { id: "double-end-bags", name: "Double End Bags", items: [] },
    { id: "rings", name: "Rings", items: [] },
    { id: "mma-cage", name: "MMA Cage", items: [] },
    { id: "floor-mats", name: "Floor Mats", items: [] },
    {
      id: "pads",
      name: "Pads",
      items: [
        {
          id: "official-boon-fmmc",
          brand: "Boon",
          name: "FMC Curved Focus Mitts",
          image: "https://cdn.shopify.com/s/files/1/2247/2949/files/FMC-1.png?v=1734687475",
          url: "/product/boon-fmmc",
          widthMeters: 0.32,
          depthMeters: 0.24,
          heightMeters: 0.12,
          scaleLabel: "0.32 m × 0.24 m"
        },
        {
          id: "official-boon-kpbs",
          brand: "Boon",
          name: "KPB Flat Kick Pads Buckle",
          image: "https://cdn.shopify.com/s/files/1/2247/2949/products/KPBL.jpg?v=1660548193",
          url: "/product/boon-kpbs",
          widthMeters: 0.75,
          depthMeters: 0.42,
          heightMeters: 0.18,
          scaleLabel: "0.75 m × 0.42 m"
        },
        {
          id: "official-boon-bpv1m",
          brand: "Boon",
          name: "BPV1 Belly Pad Velcro (Single Piece Leather)",
          image: "https://cdn.shopify.com/s/files/1/2247/2949/products/BPV1.jpg?v=1660548190",
          url: "/product/boon-bpv1m",
          widthMeters: 0.65,
          depthMeters: 0.45,
          heightMeters: 0.16,
          scaleLabel: "0.65 m × 0.45 m"
        },
        {
          id: "official-fairtex-bxp1-black-copy",
          brand: "Fairtex",
          name: "Fairtex BXP1 Boxing Paddles Black",
          image: "https://cdn.shopify.com/s/files/1/0094/9963/9868/files/fairtex-bxp1-boxing-paddles-black-612206.jpg?v=1737198972",
          url: "/product/fairtex-bxp1-black-copy",
          widthMeters: 0.55,
          depthMeters: 0.18,
          heightMeters: 0.06,
          scaleLabel: "0.55 m × 0.18 m"
        }
      ]
    },
    {
      id: "equipment",
      name: "Equipment",
      items: [
        {
          id: "official-boon-brbl",
          brand: "Boon",
          name: "BRBL Bearing Skipping Rope",
          image: "https://cdn.shopify.com/s/files/1/2247/2949/files/BRBL.jpg?v=1761716301",
          url: "/product/boon-brbl",
          widthMeters: 2.8,
          depthMeters: 0.08,
          heightMeters: 0.04,
          scaleLabel: "2.80 m × 0.08 m"
        }
      ]
    }
  ];

  var state = {
    gymWidthMeters: 10,
    gymLengthMeters: 10,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    items: [],
    selectedIds: [],
    imageCache: {},
    libraryDrag: null,
    interaction: null,
    guides: [],
    snapToGrid: true,
    multiSelectMode: false,
    copyBuffer: [],
    pasteCount: 0,
    undoStack: [],
    redoStack: []
  };

  function formatNumber(value) {
    return value.toFixed(1);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function cloneItems(items) {
    return items.map(function (item) {
      return {
        instanceId: item.instanceId,
        productId: item.productId,
        brand: item.brand,
        name: item.name,
        image: item.image,
        itemType: item.itemType || "product",
        fixtureType: item.fixtureType || "",
        quotationLabel: item.quotationLabel || "",
        visibleText: item.visibleText || "",
        widthMeters: item.widthMeters,
        depthMeters: item.depthMeters,
        xMeters: item.xMeters,
        yMeters: item.yMeters,
        rotation: item.rotation || 0
      };
    });
  }

  function currentSnapshot() {
    return {
      items: cloneItems(state.items),
      selectedIds: state.selectedIds.slice()
    };
  }

  function restoreSnapshot(snapshot) {
    state.items = cloneItems(snapshot.items);
    state.selectedIds = snapshot.selectedIds.slice();
    state.guides = [];
    render();
    syncEditorControls();
  }

  function pushHistory() {
    state.undoStack.push(currentSnapshot());
    if (state.undoStack.length > 100) state.undoStack.shift();
    state.redoStack = [];
    syncEditorControls();
  }

  function undo() {
    if (!state.undoStack.length) return;
    state.redoStack.push(currentSnapshot());
    restoreSnapshot(state.undoStack.pop());
  }

  function redo() {
    if (!state.redoStack.length) return;
    state.undoStack.push(currentSnapshot());
    restoreSnapshot(state.redoStack.pop());
  }

  function gymWidthPixels() {
    return state.gymWidthMeters * BASE_PIXELS_PER_METER * state.zoom;
  }

  function gymLengthPixels() {
    return state.gymLengthMeters * BASE_PIXELS_PER_METER * state.zoom;
  }

  function metersToPixels(meters) {
    return meters * BASE_PIXELS_PER_METER * state.zoom;
  }

  function pixelsToMeters(pixels) {
    return pixels / (BASE_PIXELS_PER_METER * state.zoom);
  }

  function resizeCanvas() {
    var rect = stage.getBoundingClientRect();
    var ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    render();
  }

  function fitToView() {
    var availableWidth = Math.max(stage.clientWidth - PADDING * 2, 120);
    var availableHeight = Math.max(stage.clientHeight - PADDING * 2, 120);
    var widthZoom = availableWidth / (state.gymWidthMeters * BASE_PIXELS_PER_METER);
    var heightZoom = availableHeight / (state.gymLengthMeters * BASE_PIXELS_PER_METER);
    state.zoom = clamp(Math.min(widthZoom, heightZoom), MIN_ZOOM, MAX_ZOOM);
    centerGym();
    syncReadouts();
    render();
  }

  function centerGym() {
    state.offsetX = (stage.clientWidth - gymWidthPixels()) / 2;
    state.offsetY = (stage.clientHeight - gymLengthPixels()) / 2;
  }

  function syncInputs() {
    widthInput.value = formatNumber(state.gymWidthMeters);
    lengthInput.value = formatNumber(state.gymLengthMeters);
  }

  function syncReadouts() {
    var area = state.gymWidthMeters * state.gymLengthMeters;
    zoomValue.textContent = Math.round(state.zoom * 100) + "%";
    gymSizeReadout.textContent = formatNumber(state.gymWidthMeters) + " m × " + formatNumber(state.gymLengthMeters) + " m";
    areaReadout.textContent = formatNumber(area) + " m²";
    scaleReadout.textContent = "1 m = " + Math.round(BASE_PIXELS_PER_METER * state.zoom) + " px";

    quickButtons.forEach(function (button) {
      var areaValue = Number(button.getAttribute("data-area"));
      button.classList.toggle("is-active", Math.abs(areaValue - area) < 0.05);
    });
  }

  function syncEditorControls() {
    var hasSelection = state.selectedIds.length > 0;
    var hasClipboard = state.copyBuffer.length > 0;
    var selectionLabel = "No items selected";

    if (state.selectedIds.length === 1) selectionLabel = "1 item selected";
    if (state.selectedIds.length > 1) selectionLabel = state.selectedIds.length + " items selected";

    selectionReadout.textContent = selectionLabel;
    undoButton.disabled = !state.undoStack.length;
    redoButton.disabled = !state.redoStack.length;
    copyButton.disabled = !hasSelection;
    pasteButton.disabled = !hasClipboard;
    duplicateButton.disabled = !hasSelection;
    deleteButton.disabled = !hasSelection;
    rotateLeftButton.disabled = !hasSelection;
    rotateRightButton.disabled = !hasSelection;
    frontButton.disabled = !hasSelection;
    backButton.disabled = !hasSelection;
    snapButton.classList.toggle("is-active", state.snapToGrid);
    snapButton.setAttribute("aria-pressed", state.snapToGrid ? "true" : "false");
    multiSelectButton.classList.toggle("is-active", state.multiSelectMode);
    multiSelectButton.setAttribute("aria-pressed", state.multiSelectMode ? "true" : "false");
  }

  function applyDimensions(widthMeters, lengthMeters, shouldFit) {
    state.gymWidthMeters = clamp(widthMeters, 1, 1000);
    state.gymLengthMeters = clamp(lengthMeters, 1, 1000);
    syncInputs();
    syncReadouts();
    if (shouldFit) fitToView();
    else render();
  }

  function zoomAroundPoint(nextZoom, anchorX, anchorY) {
    var clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    var scale = clampedZoom / state.zoom;
    state.offsetX = anchorX - (anchorX - state.offsetX) * scale;
    state.offsetY = anchorY - (anchorY - state.offsetY) * scale;
    state.zoom = clampedZoom;
    syncReadouts();
    render();
  }

  function preloadLibraryImages() {
    PRODUCT_LIBRARY.forEach(function (category) {
      category.items.forEach(function (item) {
        if (item.itemType === "fixture") return;
        var image = new Image();
        image.decoding = "async";
        image.src = item.image;
        state.imageCache[item.id] = image;
      });
    });
  }

  function renderLibrary() {
    libraryCategories.innerHTML = "";

    PRODUCT_LIBRARY.forEach(function (category, categoryIndex) {
      var details = document.createElement("details");
      details.className = "library-category";
      if (categoryIndex < 3) details.open = true;

      var summary = document.createElement("summary");
      summary.innerHTML = category.name + "<span>" + category.items.length + "</span>";
      details.appendChild(summary);

      var body = document.createElement("div");
      body.className = "library-category-body";

      if (category.notice) {
        var notice = document.createElement("p");
        notice.className = "fixture-category-notice";
        notice.textContent = category.notice;
        body.appendChild(notice);
      }

      if (!category.items.length) {
        var empty = document.createElement("p");
        empty.className = "library-empty";
        empty.textContent = "No real catalog products available in this category yet.";
        body.appendChild(empty);
      } else {
        var currentGroup = "";
        category.items.forEach(function (item) {
          if (item.group && item.group !== currentGroup) {
            currentGroup = item.group;
            var groupHeading = document.createElement("h3");
            groupHeading.className = "library-group-heading";
            groupHeading.textContent = currentGroup;
            body.appendChild(groupHeading);
          }
          if (item.referenceEquipment) body.appendChild(createReferenceEquipmentCard(item));
          else body.appendChild(item.itemType === "fixture" ? createFixtureCard(item) : createProductCard(item));
        });
      }

      details.appendChild(body);
      libraryCategories.appendChild(details);
    });
  }

  function createProductCard(item) {
    var card = document.createElement("article");
    card.className = "product-card";

    var media = document.createElement("div");
    media.className = "product-card-media";
    var image = document.createElement("img");
    image.src = item.image;
    image.alt = item.name;
    image.loading = "lazy";
    image.decoding = "async";
    media.appendChild(image);

    var copy = document.createElement("div");
    copy.className = "product-card-copy";
    copy.innerHTML =
      '<p class="product-card-brand">' + item.brand + "</p>" +
      '<h3 class="product-card-name">' + item.name + "</h3>" +
      '<p class="product-card-meta">' + item.scaleLabel + "</p>" +
      '<p class="product-card-action">Drag to place</p>';

    card.appendChild(media);
    card.appendChild(copy);

    card.addEventListener("pointerdown", function (event) {
      beginLibraryDrag(event, item, card);
    });

    return card;
  }

  function createReferenceEquipmentCard(item) {
    var card = document.createElement("article");
    card.className = "product-card fixture-card reference-equipment-card";

    var media = document.createElement("div");
    media.className = "product-card-media fixture-card-media reference-equipment-media";
    media.setAttribute("aria-hidden", "true");
    media.innerHTML = getReferenceEquipmentSvg(item.fixtureType);

    var copy = document.createElement("div");
    copy.className = "product-card-copy";
    var brand = document.createElement("p");
    brand.className = "product-card-brand";
    brand.textContent = "Reference Equipment";
    var name = document.createElement("h3");
    name.className = "product-card-name";
    name.textContent = item.editableStorageZone ? "Equipment Storage Zone" : item.name;
    var dimensions = document.createElement("p");
    dimensions.className = "product-card-meta";
    dimensions.textContent = item.scaleLabel;
    var quotation = document.createElement("p");
    quotation.className = "fixture-quotation";
    quotation.textContent = "Custom quotation required.";
    var zoneControls = null;
    if (item.editableStorageZone) zoneControls = createStorageZoneControls(item, dimensions);
    if (item.editableGymArea) zoneControls = createGymAreaControls(item, dimensions);
    var action = document.createElement("p");
    action.className = "product-card-action";
    action.textContent = "Drag to place";

    copy.appendChild(brand);
    copy.appendChild(name);
    copy.appendChild(dimensions);
    copy.appendChild(quotation);
    if (zoneControls) copy.appendChild(zoneControls.element);
    copy.appendChild(action);

    card.appendChild(media);
    card.appendChild(copy);
    card.addEventListener("pointerdown", function (event) {
      if (event.target.closest("select, input, label")) return;
      beginLibraryDrag(event, zoneControls ? zoneControls.getConfiguredItem() : item, card);
    });
    return card;
  }

  function createStorageZoneControls(item, dimensionsReadout) {
    var wrapper = document.createElement("div");
    wrapper.className = "storage-zone-controls";
    var nameField = createStorageZoneTextField("Name", item.name);
    nameField.input.setAttribute("list", "storage-zone-name-suggestions");
    var suggestions = document.createElement("datalist");
    suggestions.id = "storage-zone-name-suggestions";
    suggestions.innerHTML =
      '<option value="Pads Storage"></option>' +
      '<option value="Punch Mitts"></option>' +
      '<option value="Coach Equipment"></option>' +
      '<option value="Training Equipment"></option>';
    nameField.label.appendChild(suggestions);

    var dimensions = document.createElement("div");
    dimensions.className = "storage-zone-dimensions";
    var widthField = createFixtureDimensionInput("Width (m)", "2");
    var lengthField = createFixtureDimensionInput("Length (m)", "1.5");
    dimensions.appendChild(widthField.label);
    dimensions.appendChild(lengthField.label);

    var orientationLabel = document.createElement("label");
    var orientationText = document.createElement("span");
    orientationText.textContent = "Orientation";
    var orientation = document.createElement("select");
    orientation.innerHTML =
      '<option value="0">Horizontal</option>' +
      '<option value="90">Vertical</option>';
    orientationLabel.appendChild(orientationText);
    orientationLabel.appendChild(orientation);

    function syncZoneDimensions() {
      var width = readFixtureDimension(widthField.input);
      var length = readFixtureDimension(lengthField.input);
      dimensionsReadout.textContent = width.toFixed(2) + " m × " + length.toFixed(2) + " m";
    }

    widthField.input.addEventListener("input", syncZoneDimensions);
    lengthField.input.addEventListener("input", syncZoneDimensions);
    wrapper.appendChild(nameField.label);
    wrapper.appendChild(dimensions);
    wrapper.appendChild(orientationLabel);

    return {
      element: wrapper,
      getConfiguredItem: function () {
        var configured = Object.assign({}, item);
        configured.name = nameField.input.value.trim() || "Equipment Storage Zone";
        configured.widthMeters = readFixtureDimension(widthField.input);
        configured.depthMeters = readFixtureDimension(lengthField.input);
        configured.scaleLabel = configured.widthMeters.toFixed(2) + " m × " + configured.depthMeters.toFixed(2) + " m";
        configured.initialRotation = Number(orientation.value) || 0;
        return configured;
      }
    };
  }

  function createGymAreaControls(item, dimensionsReadout) {
    var wrapper = document.createElement("div");
    wrapper.className = "storage-zone-controls";
    var nameField = createStorageZoneTextField("Name", item.name);
    var visibleTextField = createStorageZoneTextField("Visible text", item.visibleText || item.name);

    var dimensions = document.createElement("div");
    dimensions.className = "storage-zone-dimensions";
    var widthField = createFixtureDimensionInput("Width (m)", String(item.widthMeters));
    var lengthField = createFixtureDimensionInput("Length (m)", String(item.depthMeters));
    dimensions.appendChild(widthField.label);
    dimensions.appendChild(lengthField.label);

    var orientationLabel = document.createElement("label");
    var orientationText = document.createElement("span");
    orientationText.textContent = "Orientation";
    var orientation = document.createElement("select");
    orientation.innerHTML =
      '<option value="0">Horizontal</option>' +
      '<option value="90">Vertical</option>';
    orientationLabel.appendChild(orientationText);
    orientationLabel.appendChild(orientation);

    function syncAreaDimensions() {
      var width = readFixtureDimension(widthField.input);
      var length = readFixtureDimension(lengthField.input);
      dimensionsReadout.textContent = width.toFixed(2) + " m × " + length.toFixed(2) + " m";
    }

    widthField.input.addEventListener("input", syncAreaDimensions);
    lengthField.input.addEventListener("input", syncAreaDimensions);
    wrapper.appendChild(nameField.label);
    wrapper.appendChild(dimensions);
    wrapper.appendChild(orientationLabel);
    wrapper.appendChild(visibleTextField.label);

    return {
      element: wrapper,
      getConfiguredItem: function () {
        var configured = Object.assign({}, item);
        configured.name = nameField.input.value.trim() || item.name;
        configured.visibleText = visibleTextField.input.value.trim() || configured.name;
        configured.widthMeters = readFixtureDimension(widthField.input);
        configured.depthMeters = readFixtureDimension(lengthField.input);
        configured.scaleLabel = configured.widthMeters.toFixed(2) + " m × " + configured.depthMeters.toFixed(2) + " m";
        configured.initialRotation = Number(orientation.value) || 0;
        return configured;
      }
    };
  }

  function createStorageZoneTextField(labelText, value) {
    var label = document.createElement("label");
    var text = document.createElement("span");
    text.textContent = labelText;
    var input = document.createElement("input");
    input.type = "text";
    input.value = value;
    input.maxLength = 50;
    label.appendChild(text);
    label.appendChild(input);
    return { label: label, input: input };
  }

  function getReferenceEquipmentSvg(type) {
    var start = '<svg class="reference-equipment-svg" viewBox="0 0 72 72" focusable="false" aria-hidden="true">';
    var end = "</svg>";
    var drawings = {
      "standard-heavy-bag": '<circle cx="36" cy="36" r="20" fill="#e2e8f0" stroke="#1f2937" stroke-width="4"/><circle cx="36" cy="36" r="4" fill="#1f2937"/>',
      "banana-bag": '<circle cx="36" cy="36" r="21" fill="#fef3c7" stroke="#1f2937" stroke-width="4"/><path d="M25 20c15 7 20 20 12 34 12-5 19-17 14-28-5-11-16-15-26-6Z" fill="#d97706"/>',
      "teardrop-bag": '<path d="M36 10c8 14 20 25 20 38a20 20 0 0 1-40 0c0-13 12-24 20-38Z" fill="#dbeafe" stroke="#1f2937" stroke-width="4"/>',
      "uppercut-bag": '<path d="m36 11 18 10 7 20-12 17H23L11 41l7-20 18-10Z" fill="#fee2e2" stroke="#1f2937" stroke-width="4"/><circle cx="36" cy="36" r="8" fill="none" stroke="#dc2626" stroke-width="3"/>',
      "wrecking-ball-bag": '<circle cx="36" cy="36" r="27" fill="#e2e8f0" stroke="#1f2937" stroke-width="4"/><circle cx="36" cy="36" r="17" fill="none" stroke="#64748b" stroke-width="3"/><circle cx="36" cy="36" r="5" fill="#1f2937"/>',
      "horizontal-heavy-bag": '<rect x="7" y="22" width="58" height="28" rx="14" fill="#dbeafe" stroke="#1f2937" stroke-width="4"/><path d="M21 24v24M51 24v24" stroke="#64748b" stroke-width="3"/>',
      "wall-mounted-uppercut-bag": '<path d="M8 10h56" stroke="#111827" stroke-width="7"/><path d="M18 15h36v19c0 16-8 26-18 26S18 50 18 34V15Z" fill="#fee2e2" stroke="#1f2937" stroke-width="4"/>',
      "human-training-dummy": '<circle cx="36" cy="20" r="10" fill="#f8fafc" stroke="#1f2937" stroke-width="4"/><path d="M17 55c2-16 8-25 19-25s17 9 19 25c-11 8-27 8-38 0Z" fill="#e2e8f0" stroke="#1f2937" stroke-width="4"/>',
      "speed-ball": '<path d="M36 12c11 0 17 9 14 19-2 7-9 12-14 27-5-15-12-20-14-27-3-10 3-19 14-19Z" fill="#fee2e2" stroke="#1f2937" stroke-width="4"/>',
      "double-end-bag": '<path d="M36 5v15M36 52v15" stroke="#64748b" stroke-width="3"/><circle cx="36" cy="36" r="16" fill="#dbeafe" stroke="#1f2937" stroke-width="4"/>',
      "floor-to-ceiling-ball": '<path d="M8 36h16M48 36h16M36 8v16M36 48v16" stroke="#64748b" stroke-width="3"/><circle cx="36" cy="36" r="14" fill="#dcfce7" stroke="#1f2937" stroke-width="4"/>',
      "speed-ball-wooden-platform": '<path d="M8 8h56" stroke="#111827" stroke-width="7"/><rect x="12" y="15" width="48" height="20" rx="3" fill="#d6a45d" stroke="#1f2937" stroke-width="4"/><path d="M36 35v7" stroke="#1f2937" stroke-width="3"/><path d="M36 42c8 0 11 7 8 13-2 4-6 6-8 11-2-5-6-7-8-11-3-6 0-13 8-13Z" fill="#fee2e2" stroke="#1f2937" stroke-width="3"/>',
      "thai-pad-rack": '<rect x="7" y="15" width="58" height="42" rx="5" fill="#f8fafc" stroke="#1f2937" stroke-width="4"/><rect x="13" y="21" width="12" height="30" rx="4" fill="#fee2e2" stroke="#dc2626" stroke-width="2"/><rect x="30" y="21" width="12" height="30" rx="4" fill="#fee2e2" stroke="#dc2626" stroke-width="2"/><rect x="47" y="21" width="12" height="30" rx="4" fill="#fee2e2" stroke="#dc2626" stroke-width="2"/>',
      "punch-mitt-rack": '<rect x="7" y="15" width="58" height="42" rx="5" fill="#f8fafc" stroke="#1f2937" stroke-width="4"/><ellipse cx="22" cy="36" rx="10" ry="14" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/><ellipse cx="50" cy="36" rx="10" ry="14" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/>',
      "kick-shield-rack": '<rect x="6" y="14" width="60" height="44" rx="5" fill="#f8fafc" stroke="#1f2937" stroke-width="4"/><rect x="12" y="20" width="20" height="32" rx="3" fill="#fef3c7" stroke="#d97706" stroke-width="2"/><rect x="40" y="20" width="20" height="32" rx="3" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>',
      "belly-pad-storage": '<rect x="7" y="15" width="58" height="42" rx="5" fill="#f8fafc" stroke="#1f2937" stroke-width="4"/><path d="M15 40c4-18 38-18 42 0-7 15-35 15-42 0Z" fill="#dcfce7" stroke="#15803d" stroke-width="3"/>',
      "glove-storage-shelves": '<rect x="7" y="12" width="58" height="48" rx="4" fill="#f8fafc" stroke="#1f2937" stroke-width="4"/><path d="M7 36h58M26 12v48M46 12v48" stroke="#64748b" stroke-width="2"/><circle cx="16" cy="25" r="6" fill="#dbeafe"/><circle cx="36" cy="48" r="6" fill="#fee2e2"/><circle cx="56" cy="25" r="6" fill="#fef3c7"/>',
      "headgear-storage": '<rect x="7" y="14" width="58" height="44" rx="4" fill="#f8fafc" stroke="#1f2937" stroke-width="4"/><path d="M14 42a10 10 0 0 1 20 0v8H14v-8ZM38 42a10 10 0 0 1 20 0v8H38v-8Z" fill="#e2e8f0" stroke="#64748b" stroke-width="2"/>',
      "general-equipment-shelving": '<rect x="6" y="10" width="60" height="52" rx="3" fill="#f8fafc" stroke="#1f2937" stroke-width="4"/><path d="M6 27h60M6 45h60M26 10v52M46 10v52" stroke="#64748b" stroke-width="2"/>',
      "mobile-equipment-cart": '<rect x="9" y="12" width="54" height="45" rx="7" fill="#dbeafe" stroke="#1f2937" stroke-width="4"/><path d="M16 27h40M16 42h40" stroke="#64748b" stroke-width="2"/><circle cx="17" cy="62" r="5" fill="#1f2937"/><circle cx="55" cy="62" r="5" fill="#1f2937"/>',
      "open-storage-cabinet": '<rect x="7" y="9" width="58" height="54" rx="3" fill="#f8fafc" stroke="#1f2937" stroke-width="4"/><path d="M36 9v54M7 36h58" stroke="#64748b" stroke-width="3"/>',
      "closed-storage-cabinet": '<rect x="7" y="9" width="58" height="54" rx="3" fill="#e2e8f0" stroke="#1f2937" stroke-width="4"/><path d="M36 9v54" stroke="#64748b" stroke-width="3"/><circle cx="30" cy="36" r="3" fill="#1f2937"/><circle cx="42" cy="36" r="3" fill="#1f2937"/>',
      "wall-pad-rack": '<path d="M7 10h58" stroke="#111827" stroke-width="7"/><rect x="11" y="18" width="50" height="38" rx="4" fill="#f8fafc" stroke="#1f2937" stroke-width="4"/><path d="M22 20v34M36 20v34M50 20v34" stroke="#dc2626" stroke-width="3"/>',
      "equipment-storage-zone": '<rect x="7" y="12" width="58" height="48" rx="3" fill="#eff6ff" fill-opacity=".72" stroke="#2563eb" stroke-width="4" stroke-dasharray="7 5"/><path d="M18 36h36" stroke="#2563eb" stroke-width="3"/><path d="m48 30 6 6-6 6" fill="none" stroke="#2563eb" stroke-width="3"/>'
    };
    return start + (drawings[type] || getFacilityAreaPeopleSvg(type)) + end;
  }

  function getFacilityAreaPeopleSvg(type) {
    var drawings = {
      "facility-bench": '<rect x="7" y="23" width="58" height="26" rx="6" fill="#d6a45d" stroke="#1f2937" stroke-width="4"/><path d="M20 24v24M36 24v24M52 24v24" stroke="#8b5e2d" stroke-width="2"/>',
      "facility-chair": '<rect x="15" y="15" width="42" height="42" rx="8" fill="#e2e8f0" stroke="#1f2937" stroke-width="4"/><path d="M18 50h36" stroke="#64748b" stroke-width="5"/>',
      "facility-desk": '<rect x="6" y="17" width="60" height="38" rx="4" fill="#d6a45d" stroke="#1f2937" stroke-width="4"/><rect x="26" y="25" width="20" height="13" rx="2" fill="#f8fafc" stroke="#64748b" stroke-width="2"/>',
      "facility-reception-counter": '<path d="M7 13h58v18H27v28H7V13Z" fill="#d6a45d" stroke="#1f2937" stroke-width="4"/><path d="M27 31h38" stroke="#8b5e2d" stroke-width="3"/>',
      "facility-locker": '<rect x="15" y="7" width="42" height="58" rx="3" fill="#e2e8f0" stroke="#1f2937" stroke-width="4"/><path d="M36 7v58M15 36h42" stroke="#64748b" stroke-width="2"/><circle cx="31" cy="22" r="2" fill="#1f2937"/><circle cx="41" cy="50" r="2" fill="#1f2937"/>',
      "facility-open-shelving": '<rect x="6" y="13" width="60" height="46" rx="3" fill="#f8fafc" stroke="#1f2937" stroke-width="4"/><path d="M6 28h60M6 44h60M26 13v46M46 13v46" stroke="#64748b" stroke-width="2"/>',
      "facility-water-station": '<rect x="15" y="8" width="42" height="56" rx="7" fill="#dbeafe" stroke="#1f2937" stroke-width="4"/><path d="M36 18c7 9 10 14 10 20a10 10 0 0 1-20 0c0-6 3-11 10-20Z" fill="#60a5fa"/>',
      "facility-mirror": '<rect x="5" y="25" width="62" height="22" rx="3" fill="#e0f2fe" stroke="#1f2937" stroke-width="4"/><path d="m14 40 18-10M37 42l18-10" stroke="#ffffff" stroke-width="3"/>',
      "facility-training-screen": '<rect x="5" y="20" width="62" height="32" rx="3" fill="#1f2937" stroke="#111827" stroke-width="4"/><path d="m27 27 20 9-20 9V27Z" fill="#f8fafc"/>',
      "facility-fan": '<circle cx="36" cy="36" r="29" fill="#f8fafc" stroke="#1f2937" stroke-width="4"/><circle cx="36" cy="36" r="5" fill="#1f2937"/><path d="M36 31c-6-15 7-19 13-13 6 7 0 15-13 13ZM41 36c15-6 19 7 13 13-7 6-15 0-13-13ZM36 41c6 15-7 19-13 13-6-7 0-15 13-13ZM31 36c-15 6-19-7-13-13 7-6 15 0 13 13Z" fill="#bfdbfe"/>',
      "facility-air-conditioning": '<rect x="6" y="19" width="60" height="34" rx="7" fill="#f8fafc" stroke="#1f2937" stroke-width="4"/><path d="M14 38h44M18 44h36" stroke="#60a5fa" stroke-width="3"/>',
      "facility-trash-bin": '<circle cx="36" cy="38" r="22" fill="#e2e8f0" stroke="#1f2937" stroke-width="4"/><path d="M22 19h28M29 12h14" stroke="#1f2937" stroke-width="4"/><path d="m29 31 14 14M43 31 29 45" stroke="#64748b" stroke-width="3"/>',
      "gym-area": '<rect x="6" y="9" width="60" height="54" rx="4" fill="#ecfdf5" fill-opacity=".75" stroke="#059669" stroke-width="4" stroke-dasharray="7 5"/><path d="M18 36h36" stroke="#059669" stroke-width="3"/><path d="m48 30 6 6-6 6" fill="none" stroke="#059669" stroke-width="3"/>',
      "person-trainer": '<circle cx="36" cy="24" r="12" fill="#dbeafe" stroke="#1f2937" stroke-width="4"/><path d="M13 58c3-15 12-23 23-23s20 8 23 23" fill="#2563eb" stroke="#1f2937" stroke-width="4"/>',
      "person-athlete": '<circle cx="36" cy="24" r="12" fill="#fee2e2" stroke="#1f2937" stroke-width="4"/><path d="M13 58c3-15 12-23 23-23s20 8 23 23" fill="#dc2626" stroke="#1f2937" stroke-width="4"/>',
      "people-group": '<circle cx="20" cy="23" r="9" fill="#dbeafe" stroke="#1f2937" stroke-width="3"/><circle cx="52" cy="23" r="9" fill="#fee2e2" stroke="#1f2937" stroke-width="3"/><circle cx="36" cy="43" r="10" fill="#dcfce7" stroke="#1f2937" stroke-width="3"/><path d="M7 61c2-12 7-19 13-19M65 61c-2-12-7-19-13-19M20 65c3-12 8-18 16-18s13 6 16 18" fill="none" stroke="#64748b" stroke-width="3"/>',
      "mascot-dog": '<ellipse cx="38" cy="38" rx="24" ry="16" fill="#d6a45d" stroke="#1f2937" stroke-width="4"/><circle cx="15" cy="38" r="10" fill="#d6a45d" stroke="#1f2937" stroke-width="4"/><path d="m9 29-4-10 12 7M61 34c10-10 11 6 4 10" fill="none" stroke="#1f2937" stroke-width="4"/><circle cx="12" cy="37" r="2" fill="#111827"/>',
      "mascot-cat": '<ellipse cx="39" cy="39" rx="21" ry="14" fill="#e2e8f0" stroke="#1f2937" stroke-width="4"/><path d="M12 36 8 22l11 7 10-7-1 15" fill="#e2e8f0" stroke="#1f2937" stroke-width="4"/><path d="M59 38c13-9 12 10 4 15" fill="none" stroke="#1f2937" stroke-width="4"/><circle cx="17" cy="34" r="2" fill="#111827"/>'
    };
    return drawings[type] || "";
  }

  function createFixtureCard(item) {
    var card = document.createElement("article");
    card.className = "product-card fixture-card";

    var media = document.createElement("div");
    media.className = "product-card-media fixture-card-media fixture-card-media--" + item.fixtureType;
    media.setAttribute("aria-hidden", "true");
    media.innerHTML = item.fixtureType === "ring"
      ? '<span class="fixture-ring-preview"><i></i><i></i><i></i><i></i></span>'
      : '<span class="fixture-cage-preview"><i></i></span>';

    var copy = document.createElement("div");
    copy.className = "product-card-copy";

    var brand = document.createElement("p");
    brand.className = "product-card-brand";
    brand.textContent = item.brand;
    var name = document.createElement("h3");
    name.className = "product-card-name";
    name.textContent = item.name;
    var quotation = document.createElement("p");
    quotation.className = "fixture-quotation";
    quotation.textContent = item.quotationLabel;
    var controls = createFixtureSizeControls(item);
    var action = document.createElement("p");
    action.className = "product-card-action";
    action.textContent = "Drag to place";

    copy.appendChild(brand);
    copy.appendChild(name);
    copy.appendChild(quotation);
    copy.appendChild(controls.element);
    copy.appendChild(action);
    card.appendChild(media);
    card.appendChild(copy);

    card.addEventListener("pointerdown", function (event) {
      if (event.target.closest("select, input, label")) return;
      beginLibraryDrag(event, controls.getConfiguredItem(), card);
    });

    return card;
  }

  function createFixtureSizeControls(item) {
    var wrapper = document.createElement("div");
    wrapper.className = "fixture-size-controls";
    var selectLabel = document.createElement("label");
    selectLabel.innerHTML = "<span>Approximate dimensions</span>";
    var select = document.createElement("select");
    select.setAttribute("aria-label", item.name + " dimensions");

    if (item.fixtureType === "ring") {
      select.innerHTML =
        '<option value="5x5">5 × 5 meters</option>' +
        '<option value="6x6">6 × 6 meters</option>' +
        '<option value="custom">Custom dimensions</option>';
    } else {
      select.innerHTML =
        '<option value="5">Approx. 5 meter diameter</option>' +
        '<option value="7">Approx. 7 meter diameter</option>' +
        '<option value="custom">Custom dimensions</option>';
    }
    selectLabel.appendChild(select);
    wrapper.appendChild(selectLabel);

    var customFields = document.createElement("div");
    customFields.className = "fixture-custom-fields";
    customFields.hidden = true;
    var firstInput = createFixtureDimensionInput(item.fixtureType === "ring" ? "Width (m)" : "Diameter (m)", "5");
    customFields.appendChild(firstInput.label);
    var secondInput = null;

    if (item.fixtureType === "ring") {
      secondInput = createFixtureDimensionInput("Length (m)", "5");
      customFields.appendChild(secondInput.label);
    }

    wrapper.appendChild(customFields);
    select.addEventListener("change", function () {
      customFields.hidden = select.value !== "custom";
    });

    return {
      element: wrapper,
      getConfiguredItem: function () {
        var configured = Object.assign({}, item);
        if (item.fixtureType === "ring") {
          var dimensions = select.value === "custom"
            ? [readFixtureDimension(firstInput.input), readFixtureDimension(secondInput.input)]
            : select.value.split("x").map(Number);
          configured.widthMeters = dimensions[0];
          configured.depthMeters = dimensions[1];
          configured.scaleLabel = dimensions[0].toFixed(2) + " m × " + dimensions[1].toFixed(2) + " m";
        } else {
          var diameter = select.value === "custom" ? readFixtureDimension(firstInput.input) : Number(select.value);
          configured.widthMeters = diameter;
          configured.depthMeters = diameter;
          configured.scaleLabel = "Approx. " + diameter.toFixed(2) + " m diameter";
        }
        return configured;
      }
    };
  }

  function createFixtureDimensionInput(labelText, value) {
    var label = document.createElement("label");
    var text = document.createElement("span");
    text.textContent = labelText;
    var input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.max = "50";
    input.step = "0.1";
    input.value = value;
    input.inputMode = "decimal";
    label.appendChild(text);
    label.appendChild(input);
    return { label: label, input: input };
  }

  function readFixtureDimension(input) {
    var value = parseFloat(input.value);
    if (!isFinite(value)) value = 5;
    return clamp(value, 1, 50);
  }

  function beginLibraryDrag(event, item, card) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();

    state.libraryDrag = {
      item: item,
      pointerId: event.pointerId,
      sourceCard: card,
      overStage: false
    };

    card.classList.add("is-dragging");
    if (item.referenceEquipment) {
      dragPreview.innerHTML = getReferenceEquipmentSvg(item.fixtureType);
    } else if (item.itemType === "fixture") {
      dragPreview.innerHTML = '<span class="drag-fixture-preview drag-fixture-preview--' + item.fixtureType + '"></span>';
    } else {
      dragPreview.innerHTML = '<img src="' + item.image + '" alt="">';
    }
    dragPreview.hidden = false;
    updateDragPreview(event.clientX, event.clientY);
    updateStageDropState(event.clientX, event.clientY);

    window.addEventListener("pointermove", handleLibraryDragMove);
    window.addEventListener("pointerup", endLibraryDrag);
    window.addEventListener("pointercancel", endLibraryDrag);
  }

  function handleLibraryDragMove(event) {
    if (!state.libraryDrag || event.pointerId !== state.libraryDrag.pointerId) return;
    updateDragPreview(event.clientX, event.clientY);
    updateStageDropState(event.clientX, event.clientY);
  }

  function updateDragPreview(clientX, clientY) {
    dragPreview.style.left = clientX + "px";
    dragPreview.style.top = clientY + "px";
  }

  function updateStageDropState(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var isOverStage = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    if (state.libraryDrag) state.libraryDrag.overStage = isOverStage;
    stageDropIndicator.hidden = !isOverStage;
  }

  function endLibraryDrag(event) {
    if (!state.libraryDrag || event.pointerId !== state.libraryDrag.pointerId) return;

    if (state.libraryDrag.overStage) {
      pushHistory();
      placeProductAtPoint(state.libraryDrag.item, event.clientX, event.clientY);
    }

    state.libraryDrag.sourceCard.classList.remove("is-dragging");
    state.libraryDrag = null;
    dragPreview.hidden = true;
    stageDropIndicator.hidden = true;

    window.removeEventListener("pointermove", handleLibraryDragMove);
    window.removeEventListener("pointerup", endLibraryDrag);
    window.removeEventListener("pointercancel", endLibraryDrag);
  }

  function makeInstanceId(productId) {
    return productId + "::" + Date.now() + "::" + Math.random().toString(36).slice(2, 7);
  }

  function placeProductAtPoint(item, clientX, clientY) {
    var point = stagePointToMeters(clientX, clientY);
    var xMeters = point.x - item.widthMeters / 2;
    var yMeters = point.y - item.depthMeters / 2;
    var placed = createPlacedItem(item, xMeters, yMeters, item.initialRotation || 0);
    clampItemIntoGym(placed);
    state.items.push(placed);
    state.selectedIds = [placed.instanceId];
    render();
    syncEditorControls();
  }

  function createPlacedItem(item, xMeters, yMeters, rotation) {
    return {
      instanceId: makeInstanceId(item.id),
      productId: item.id,
      brand: item.brand,
      name: item.name,
      image: item.image,
      itemType: item.itemType || "product",
      fixtureType: item.fixtureType || "",
      quotationLabel: item.quotationLabel || "",
      visibleText: item.visibleText || "",
      widthMeters: item.widthMeters,
      depthMeters: item.depthMeters,
      xMeters: xMeters,
      yMeters: yMeters,
      rotation: rotation || 0
    };
  }

  function stagePointToMeters(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: pixelsToMeters(clientX - rect.left - state.offsetX),
      y: pixelsToMeters(clientY - rect.top - state.offsetY)
    };
  }

  function worldPointToScreen(point) {
    return {
      x: state.offsetX + metersToPixels(point.x),
      y: state.offsetY + metersToPixels(point.y)
    };
  }

  function degreesToRadians(value) {
    return value * Math.PI / 180;
  }

  function normalizeRotation(value) {
    var result = value % 360;
    if (result < 0) result += 360;
    return result;
  }

  function itemCenter(item) {
    return {
      x: item.xMeters + item.widthMeters / 2,
      y: item.yMeters + item.depthMeters / 2
    };
  }

  function itemCorners(item) {
    var center = itemCenter(item);
    var angle = degreesToRadians(item.rotation || 0);
    var cos = Math.cos(angle);
    var sin = Math.sin(angle);
    var halfWidth = item.widthMeters / 2;
    var halfHeight = item.depthMeters / 2;
    var localCorners = [
      { x: -halfWidth, y: -halfHeight },
      { x: halfWidth, y: -halfHeight },
      { x: halfWidth, y: halfHeight },
      { x: -halfWidth, y: halfHeight }
    ];

    return localCorners.map(function (corner) {
      return {
        x: center.x + corner.x * cos - corner.y * sin,
        y: center.y + corner.x * sin + corner.y * cos
      };
    });
  }

  function itemAabb(item) {
    var corners = itemCorners(item);
    var xs = corners.map(function (corner) { return corner.x; });
    var ys = corners.map(function (corner) { return corner.y; });
    return {
      left: Math.min.apply(null, xs),
      right: Math.max.apply(null, xs),
      top: Math.min.apply(null, ys),
      bottom: Math.max.apply(null, ys),
      centerX: itemCenter(item).x,
      centerY: itemCenter(item).y
    };
  }

  function hitTest(point) {
    for (var index = state.items.length - 1; index >= 0; index -= 1) {
      var item = state.items[index];
      if (pointInsideItem(point, item)) return item;
    }
    return null;
  }

  function pointInsideItem(point, item) {
    var center = itemCenter(item);
    var angle = -degreesToRadians(item.rotation || 0);
    var dx = point.x - center.x;
    var dy = point.y - center.y;
    var localX = dx * Math.cos(angle) - dy * Math.sin(angle);
    var localY = dx * Math.sin(angle) + dy * Math.cos(angle);
    return Math.abs(localX) <= item.widthMeters / 2 && Math.abs(localY) <= item.depthMeters / 2;
  }

  function selectOnly(instanceId) {
    state.selectedIds = instanceId ? [instanceId] : [];
    render();
    syncEditorControls();
  }

  function toggleSelection(instanceId) {
    var selected = state.selectedIds.indexOf(instanceId);
    if (selected >= 0) state.selectedIds.splice(selected, 1);
    else state.selectedIds.push(instanceId);
    render();
    syncEditorControls();
  }

  function selectedItems() {
    return state.items.filter(function (item) {
      return state.selectedIds.indexOf(item.instanceId) >= 0;
    });
  }

  function selectionBounds(items) {
    if (!items.length) return null;
    var bounds = itemAabb(items[0]);
    for (var i = 1; i < items.length; i += 1) {
      var current = itemAabb(items[i]);
      bounds.left = Math.min(bounds.left, current.left);
      bounds.right = Math.max(bounds.right, current.right);
      bounds.top = Math.min(bounds.top, current.top);
      bounds.bottom = Math.max(bounds.bottom, current.bottom);
    }
    bounds.centerX = (bounds.left + bounds.right) / 2;
    bounds.centerY = (bounds.top + bounds.bottom) / 2;
    return bounds;
  }

  function clampItemIntoGym(item) {
    var bounds = itemAabb(item);
    if (bounds.left < 0) item.xMeters += -bounds.left;
    if (bounds.top < 0) item.yMeters += -bounds.top;
    bounds = itemAabb(item);
    if (bounds.right > state.gymWidthMeters) item.xMeters -= (bounds.right - state.gymWidthMeters);
    if (bounds.bottom > state.gymLengthMeters) item.yMeters -= (bounds.bottom - state.gymLengthMeters);
    item.xMeters = clamp(item.xMeters, -10, state.gymWidthMeters + 10);
    item.yMeters = clamp(item.yMeters, -10, state.gymLengthMeters + 10);
  }

  function snapValue(value) {
    return Math.round(value / GRID_SNAP_METERS) * GRID_SNAP_METERS;
  }

  function getSnapAdjustment(movingItems) {
    var selectionBox = selectionBounds(movingItems);
    if (!selectionBox) return { dx: 0, dy: 0, guides: [] };

    var bestDx = 0;
    var bestDy = 0;
    var bestDxDistance = Infinity;
    var bestDyDistance = Infinity;
    var guides = [];

    if (state.snapToGrid) {
      [
        selectionBox.left,
        selectionBox.centerX,
        selectionBox.right
      ].forEach(function (value) {
        var delta = snapValue(value) - value;
        if (Math.abs(delta) < Math.abs(bestDxDistance) && Math.abs(delta) <= SNAP_THRESHOLD_METERS) {
          bestDxDistance = delta;
          bestDx = delta;
        }
      });

      [
        selectionBox.top,
        selectionBox.centerY,
        selectionBox.bottom
      ].forEach(function (value) {
        var delta = snapValue(value) - value;
        if (Math.abs(delta) < Math.abs(bestDyDistance) && Math.abs(delta) <= SNAP_THRESHOLD_METERS) {
          bestDyDistance = delta;
          bestDy = delta;
        }
      });
    }

    var alignmentX = [
      { value: 0, label: "edge" },
      { value: state.gymWidthMeters / 2, label: "center" },
      { value: state.gymWidthMeters, label: "edge" }
    ];
    var alignmentY = [
      { value: 0, label: "edge" },
      { value: state.gymLengthMeters / 2, label: "center" },
      { value: state.gymLengthMeters, label: "edge" }
    ];

    state.items.forEach(function (item) {
      if (state.selectedIds.indexOf(item.instanceId) >= 0) return;
      var bounds = itemAabb(item);
      alignmentX.push({ value: bounds.left, label: "edge" });
      alignmentX.push({ value: bounds.centerX, label: "center" });
      alignmentX.push({ value: bounds.right, label: "edge" });
      alignmentY.push({ value: bounds.top, label: "edge" });
      alignmentY.push({ value: bounds.centerY, label: "center" });
      alignmentY.push({ value: bounds.bottom, label: "edge" });
    });

    [
      { key: "left", value: selectionBox.left },
      { key: "centerX", value: selectionBox.centerX },
      { key: "right", value: selectionBox.right }
    ].forEach(function (candidate) {
      alignmentX.forEach(function (target) {
        var delta = target.value - candidate.value;
        if (Math.abs(delta) < Math.abs(bestDxDistance) && Math.abs(delta) <= ALIGN_THRESHOLD_METERS) {
          bestDxDistance = delta;
          bestDx = delta;
          guides[0] = { axis: "x", value: target.value };
        }
      });
    });

    [
      { key: "top", value: selectionBox.top },
      { key: "centerY", value: selectionBox.centerY },
      { key: "bottom", value: selectionBox.bottom }
    ].forEach(function (candidate) {
      alignmentY.forEach(function (target) {
        var delta = target.value - candidate.value;
        if (Math.abs(delta) < Math.abs(bestDyDistance) && Math.abs(delta) <= ALIGN_THRESHOLD_METERS) {
          bestDyDistance = delta;
          bestDy = delta;
          guides[1] = { axis: "y", value: target.value };
        }
      });
    });

    return {
      dx: bestDx,
      dy: bestDy,
      guides: guides.filter(Boolean)
    };
  }

  function beginCanvasInteraction(event) {
    if (state.libraryDrag) return;

    var worldPoint = stagePointToMeters(event.clientX, event.clientY);
    var target = hitTest(worldPoint);
    var additiveSelection = event.shiftKey || state.multiSelectMode;

    if (target) {
      if (additiveSelection) {
        toggleSelection(target.instanceId);
      } else if (state.selectedIds.indexOf(target.instanceId) < 0) {
        state.selectedIds = [target.instanceId];
        render();
        syncEditorControls();
      }

      state.interaction = {
        type: "move",
        pointerId: event.pointerId,
        startWorld: worldPoint,
        originalItems: cloneItems(selectedItems())
      };
      pushHistory();
      canvas.setPointerCapture(event.pointerId);
      return;
    }

    if (additiveSelection) {
      state.interaction = {
        type: "marquee",
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        currentClientX: event.clientX,
        currentClientY: event.clientY
      };
      canvas.setPointerCapture(event.pointerId);
      return;
    }

    state.interaction = {
      type: "pan",
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: state.offsetX,
      startOffsetY: state.offsetY
    };
    canvas.setPointerCapture(event.pointerId);
  }

  function updateCanvasInteraction(event) {
    if (!state.interaction || state.interaction.pointerId !== event.pointerId) return;

    if (state.interaction.type === "pan") {
      state.offsetX = state.interaction.startOffsetX + (event.clientX - state.interaction.startClientX);
      state.offsetY = state.interaction.startOffsetY + (event.clientY - state.interaction.startClientY);
      render();
      return;
    }

    if (state.interaction.type === "marquee") {
      state.interaction.currentClientX = event.clientX;
      state.interaction.currentClientY = event.clientY;
      render();
      return;
    }

    if (state.interaction.type === "move") {
      var currentWorld = stagePointToMeters(event.clientX, event.clientY);
      var deltaX = currentWorld.x - state.interaction.startWorld.x;
      var deltaY = currentWorld.y - state.interaction.startWorld.y;
      var movedIds = state.selectedIds.slice();
      var movedItems = [];

      state.items.forEach(function (item) {
        var original = state.interaction.originalItems.find(function (candidate) {
          return candidate.instanceId === item.instanceId;
        });

        if (!original) return;

        item.xMeters = original.xMeters + deltaX;
        item.yMeters = original.yMeters + deltaY;
        movedItems.push(item);
      });

      var adjustment = getSnapAdjustment(movedItems);

      movedItems.forEach(function (item) {
        item.xMeters += adjustment.dx;
        item.yMeters += adjustment.dy;
        clampItemIntoGym(item);
      });

      state.guides = adjustment.guides;
      render();
      return;
    }
  }

  function finishCanvasInteraction(event) {
    if (!state.interaction || state.interaction.pointerId !== event.pointerId) return;

    if (state.interaction.type === "marquee") {
      var selection = marqueeSelection(state.interaction);
      state.selectedIds = selection;
    }

    state.guides = [];
    state.interaction = null;
    canvas.releasePointerCapture(event.pointerId);
    render();
    syncEditorControls();
  }

  function marqueeSelection(interaction) {
    var rect = normalizedRect(
      interaction.startClientX,
      interaction.startClientY,
      interaction.currentClientX,
      interaction.currentClientY
    );
    var worldStart = stagePointToMeters(rect.left, rect.top);
    var worldEnd = stagePointToMeters(rect.right, rect.bottom);
    var worldRect = {
      left: Math.min(worldStart.x, worldEnd.x),
      right: Math.max(worldStart.x, worldEnd.x),
      top: Math.min(worldStart.y, worldEnd.y),
      bottom: Math.max(worldStart.y, worldEnd.y)
    };

    return state.items.filter(function (item) {
      var bounds = itemAabb(item);
      return bounds.left >= worldRect.left &&
        bounds.right <= worldRect.right &&
        bounds.top >= worldRect.top &&
        bounds.bottom <= worldRect.bottom;
    }).map(function (item) {
      return item.instanceId;
    });
  }

  function normalizedRect(x1, y1, x2, y2) {
    return {
      left: Math.min(x1, x2),
      right: Math.max(x1, x2),
      top: Math.min(y1, y2),
      bottom: Math.max(y1, y2)
    };
  }

  function duplicateSelection() {
    var selected = selectedItems();
    if (!selected.length) return;
    pushHistory();

    var duplicates = selected.map(function (item) {
      var copy = cloneItems([item])[0];
      copy.instanceId = makeInstanceId(item.productId);
      copy.xMeters += 0.35;
      copy.yMeters += 0.35;
      clampItemIntoGym(copy);
      return copy;
    });

    state.items = state.items.concat(duplicates);
    state.selectedIds = duplicates.map(function (item) { return item.instanceId; });
    render();
    syncEditorControls();
  }

  function deleteSelection() {
    if (!state.selectedIds.length) return;
    pushHistory();
    state.items = state.items.filter(function (item) {
      return state.selectedIds.indexOf(item.instanceId) < 0;
    });
    state.selectedIds = [];
    render();
    syncEditorControls();
  }

  function rotateSelection(step) {
    var selected = selectedItems();
    if (!selected.length) return;
    pushHistory();
    selected.forEach(function (item) {
      item.rotation = normalizeRotation((item.rotation || 0) + step);
      clampItemIntoGym(item);
    });
    render();
    syncEditorControls();
  }

  function bringSelectionToFront() {
    if (!state.selectedIds.length) return;
    pushHistory();
    var selectedSet = {};
    state.selectedIds.forEach(function (id) { selectedSet[id] = true; });
    var remaining = state.items.filter(function (item) { return !selectedSet[item.instanceId]; });
    var selected = state.items.filter(function (item) { return selectedSet[item.instanceId]; });
    state.items = remaining.concat(selected);
    render();
  }

  function sendSelectionToBack() {
    if (!state.selectedIds.length) return;
    pushHistory();
    var selectedSet = {};
    state.selectedIds.forEach(function (id) { selectedSet[id] = true; });
    var selected = state.items.filter(function (item) { return selectedSet[item.instanceId]; });
    var remaining = state.items.filter(function (item) { return !selectedSet[item.instanceId]; });
    state.items = selected.concat(remaining);
    render();
  }

  function copySelection() {
    var selected = selectedItems();
    if (!selected.length) return;
    var bounds = selectionBounds(selected);
    state.copyBuffer = selected.map(function (item) {
      return {
        productId: item.productId,
        brand: item.brand,
        name: item.name,
        image: item.image,
        itemType: item.itemType || "product",
        fixtureType: item.fixtureType || "",
        quotationLabel: item.quotationLabel || "",
        visibleText: item.visibleText || "",
        widthMeters: item.widthMeters,
        depthMeters: item.depthMeters,
        rotation: item.rotation || 0,
        relativeX: item.xMeters - bounds.left,
        relativeY: item.yMeters - bounds.top
      };
    });
    state.pasteCount = 0;
    syncEditorControls();
  }

  function pasteSelection() {
    if (!state.copyBuffer.length) return;
    pushHistory();

    state.pasteCount += 1;
    var offset = 0.4 * state.pasteCount;
    var pasted = state.copyBuffer.map(function (item) {
      var placed = {
        instanceId: makeInstanceId(item.productId),
        productId: item.productId,
        brand: item.brand,
        name: item.name,
        image: item.image,
        itemType: item.itemType || "product",
        fixtureType: item.fixtureType || "",
        quotationLabel: item.quotationLabel || "",
        visibleText: item.visibleText || "",
        widthMeters: item.widthMeters,
        depthMeters: item.depthMeters,
        xMeters: item.relativeX + offset,
        yMeters: item.relativeY + offset,
        rotation: item.rotation
      };
      clampItemIntoGym(placed);
      return placed;
    });

    state.items = state.items.concat(pasted);
    state.selectedIds = pasted.map(function (item) { return item.instanceId; });
    render();
    syncEditorControls();
  }

  function drawGrid() {
    var minor = metersToPixels(MINOR_GRID_METERS);
    var major = metersToPixels(MAJOR_GRID_METERS);
    var width = stage.clientWidth;
    var height = stage.clientHeight;

    context.save();
    context.strokeStyle = "#ececf1";
    context.lineWidth = 1;
    drawGridLines(minor, width, height);
    context.strokeStyle = "#d7d7de";
    context.lineWidth = 1.2;
    drawGridLines(major, width, height);
    context.restore();
  }

  function drawGridLines(step, width, height) {
    if (!isFinite(step) || step <= 0) return;

    var startX = state.offsetX % step;
    if (startX < 0) startX += step;
    var startY = state.offsetY % step;
    if (startY < 0) startY += step;

    context.beginPath();
    for (var x = startX; x <= width; x += step) {
      context.moveTo(Math.round(x) + 0.5, 0);
      context.lineTo(Math.round(x) + 0.5, height);
    }
    for (var y = startY; y <= height; y += step) {
      context.moveTo(0, Math.round(y) + 0.5);
      context.lineTo(width, Math.round(y) + 0.5);
    }
    context.stroke();
  }

  function drawGymOutline() {
    var x = state.offsetX;
    var y = state.offsetY;
    var width = gymWidthPixels();
    var height = gymLengthPixels();

    context.save();
    context.fillStyle = "#ffffff";
    context.strokeStyle = "#111111";
    context.lineWidth = 2;
    context.fillRect(x, y, width, height);
    context.strokeRect(x, y, width, height);
    context.restore();
  }

  function drawPlacedItems() {
    state.items.forEach(function (item) {
      if (item.itemType === "fixture") {
        drawFixtureItem(item);
        return;
      }

      var center = itemCenter(item);
      var screenCenter = worldPointToScreen(center);
      var width = metersToPixels(item.widthMeters);
      var height = metersToPixels(item.depthMeters);
      var image = state.imageCache[item.productId];
      var isSelected = state.selectedIds.indexOf(item.instanceId) >= 0;

      context.save();
      context.translate(screenCenter.x, screenCenter.y);
      context.rotate(degreesToRadians(item.rotation || 0));
      roundRectPath(-width / 2, -height / 2, width, height, 12);
      context.clip();

      if (image && image.complete) drawCoverImage(image, -width / 2, -height / 2, width, height);
      else {
        context.fillStyle = "#f3f4f6";
        context.fillRect(-width / 2, -height / 2, width, height);
      }

      context.restore();

      context.save();
      context.translate(screenCenter.x, screenCenter.y);
      context.rotate(degreesToRadians(item.rotation || 0));
      context.strokeStyle = isSelected ? "#1d4ed8" : "#111111";
      context.lineWidth = isSelected ? 2.5 : 1.5;
      roundRectPath(-width / 2, -height / 2, width, height, 12);
      context.stroke();

      if (isSelected) {
        drawSelectionCorners(width, height);
      }
      context.restore();

      context.save();
      context.fillStyle = "rgba(255, 255, 255, 0.95)";
      context.fillRect(screenCenter.x - width / 2 + 6, screenCenter.y - height / 2 + 6, Math.min(width - 12, 132), 20);
      context.fillStyle = "#111111";
      context.font = "11px Segoe UI, Arial, sans-serif";
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.fillText(item.brand, screenCenter.x - width / 2 + 10, screenCenter.y - height / 2 + 16);
      context.restore();
    });
  }

  function drawFixtureItem(item) {
    var center = itemCenter(item);
    var screenCenter = worldPointToScreen(center);
    var width = metersToPixels(item.widthMeters);
    var height = metersToPixels(item.depthMeters);
    var isSelected = state.selectedIds.indexOf(item.instanceId) >= 0;

    context.save();
    context.translate(screenCenter.x, screenCenter.y);
    context.rotate(degreesToRadians(item.rotation || 0));

    if (item.fixtureType === "ring") drawRingFixture(width, height);
    else if (item.fixtureType === "cage") drawCageFixture(width, height);
    else if (item.fixtureType === "gym-area") drawGymAreaFixture(width, height, item.visibleText || item.name);
    else drawReferenceEquipmentFixture(item.fixtureType, width, height);

    if (isSelected) {
      context.strokeStyle = "#1d4ed8";
      context.lineWidth = 2.5;
      context.setLineDash([7, 5]);
      context.strokeRect(-width / 2, -height / 2, width, height);
      context.setLineDash([]);
      drawSelectionCorners(width, height);
    }
    context.restore();

    context.save();
    context.font = "11px Segoe UI, Arial, sans-serif";
    var labelName = item.visibleText || item.name;
    var label = labelName + " · " + item.widthMeters.toFixed(1) + " × " + item.depthMeters.toFixed(1) + " m";
    var labelWidth = Math.min(context.measureText(label).width + 16, Math.max(width, 124));
    context.fillStyle = "rgba(255, 255, 255, 0.94)";
    context.fillRect(screenCenter.x - labelWidth / 2, screenCenter.y - height / 2 + 7, labelWidth, 20);
    context.fillStyle = "#111111";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, screenCenter.x, screenCenter.y - height / 2 + 17, labelWidth - 10);
    context.restore();
  }

  function drawRingFixture(width, height) {
    var platformInset = Math.max(1, Math.min(width, height) * 0.025);
    var ropeGap = Math.max(1, Math.min(width, height) * 0.035);
    var postSize = Math.max(4, Math.min(width, height) * 0.045);

    context.fillStyle = "rgba(219, 234, 254, 0.58)";
    context.strokeStyle = "#334155";
    context.lineWidth = 2;
    context.fillRect(-width / 2, -height / 2, width, height);
    context.strokeRect(-width / 2, -height / 2, width, height);

    context.fillStyle = "rgba(255, 255, 255, 0.72)";
    context.fillRect(-width / 2 + ropeGap * 3, -height / 2 + ropeGap * 3, width - ropeGap * 6, height - ropeGap * 6);

    ["#dc2626", "#f8fafc", "#2563eb"].forEach(function (color, index) {
      var inset = platformInset + ropeGap * (index + 1);
      context.strokeStyle = color;
      context.lineWidth = Math.max(1.5, ropeGap * 0.22);
      context.strokeRect(-width / 2 + inset, -height / 2 + inset, width - inset * 2, height - inset * 2);
    });

    context.fillStyle = "#111827";
    [
      [-width / 2, -height / 2],
      [width / 2, -height / 2],
      [width / 2, height / 2],
      [-width / 2, height / 2]
    ].forEach(function (post) {
      context.fillRect(post[0] - postSize / 2, post[1] - postSize / 2, postSize, postSize);
    });
  }

  function drawCageFixture(width, height) {
    var insetX = width * 0.17;
    var insetY = height * 0.17;
    var points = [
      [-width / 2 + insetX, -height / 2],
      [width / 2 - insetX, -height / 2],
      [width / 2, -height / 2 + insetY],
      [width / 2, height / 2 - insetY],
      [width / 2 - insetX, height / 2],
      [-width / 2 + insetX, height / 2],
      [-width / 2, height / 2 - insetY],
      [-width / 2, -height / 2 + insetY]
    ];

    context.beginPath();
    points.forEach(function (point, index) {
      if (index === 0) context.moveTo(point[0], point[1]);
      else context.lineTo(point[0], point[1]);
    });
    context.closePath();
    context.fillStyle = "rgba(226, 232, 240, 0.48)";
    context.strokeStyle = "#1f2937";
    context.lineWidth = Math.max(3, Math.min(width, height) * 0.018);
    context.fill();
    context.stroke();

    var doorStart = points[3];
    var doorEnd = points[4];
    context.strokeStyle = "#dc2626";
    context.lineWidth = Math.max(5, Math.min(width, height) * 0.035);
    context.beginPath();
    context.moveTo(doorStart[0], doorStart[1]);
    context.lineTo(doorEnd[0], doorEnd[1]);
    context.stroke();

    context.fillStyle = "#dc2626";
    context.beginPath();
    context.arc((doorStart[0] + doorEnd[0]) / 2, (doorStart[1] + doorEnd[1]) / 2, Math.max(5, Math.min(width, height) * 0.025), 0, Math.PI * 2);
    context.fill();
  }

  function drawReferenceEquipmentFixture(type, width, height) {
    if (isStorageEquipmentType(type)) {
      drawStorageEquipmentFixture(type, width, height);
      return;
    }
    if (isFacilityOrPeopleType(type)) {
      drawFacilityOrPeopleFixture(type, width, height);
      return;
    }

    var minSize = Math.min(width, height);
    context.lineWidth = Math.max(1.5, minSize * 0.055);
    context.strokeStyle = "#1f2937";
    context.fillStyle = "rgba(226, 232, 240, 0.78)";

    if (type === "horizontal-heavy-bag") {
      roundRectPath(-width / 2, -height / 2, width, height, height / 2);
      context.fill();
      context.stroke();
      context.beginPath();
      context.moveTo(-width * 0.25, -height / 2);
      context.lineTo(-width * 0.25, height / 2);
      context.moveTo(width * 0.25, -height / 2);
      context.lineTo(width * 0.25, height / 2);
      context.strokeStyle = "#64748b";
      context.stroke();
      return;
    }

    if (type === "wall-mounted-uppercut-bag") {
      context.strokeStyle = "#111827";
      context.lineWidth = Math.max(3, minSize * 0.1);
      context.beginPath();
      context.moveTo(-width / 2, -height / 2);
      context.lineTo(width / 2, -height / 2);
      context.stroke();
      context.fillStyle = "rgba(254, 226, 226, 0.8)";
      context.strokeStyle = "#1f2937";
      context.lineWidth = Math.max(1.5, minSize * 0.055);
      roundRectPath(-width * 0.36, -height * 0.38, width * 0.72, height * 0.82, width * 0.18);
      context.fill();
      context.stroke();
      return;
    }

    if (type === "human-training-dummy") {
      context.beginPath();
      context.ellipse(0, -height * 0.24, width * 0.16, height * 0.16, 0, 0, Math.PI * 2);
      context.fillStyle = "#f8fafc";
      context.fill();
      context.stroke();
      context.beginPath();
      context.ellipse(0, height * 0.16, width * 0.4, height * 0.3, 0, 0, Math.PI * 2);
      context.fillStyle = "rgba(226, 232, 240, 0.82)";
      context.fill();
      context.stroke();
      return;
    }

    if (type === "speed-ball-wooden-platform") {
      context.strokeStyle = "#111827";
      context.lineWidth = Math.max(3, minSize * 0.09);
      context.beginPath();
      context.moveTo(-width / 2, -height / 2);
      context.lineTo(width / 2, -height / 2);
      context.stroke();
      context.fillStyle = "rgba(214, 164, 93, 0.8)";
      context.strokeStyle = "#1f2937";
      context.lineWidth = Math.max(1.5, minSize * 0.045);
      context.fillRect(-width * 0.44, -height * 0.39, width * 0.88, height * 0.34);
      context.strokeRect(-width * 0.44, -height * 0.39, width * 0.88, height * 0.34);
      context.beginPath();
      context.moveTo(0, -height * 0.05);
      context.lineTo(0, height * 0.1);
      context.stroke();
      context.beginPath();
      context.ellipse(0, height * 0.28, width * 0.11, height * 0.17, 0, 0, Math.PI * 2);
      context.fillStyle = "rgba(254, 226, 226, 0.9)";
      context.fill();
      context.stroke();
      return;
    }

    if (type === "double-end-bag" || type === "floor-to-ceiling-ball") {
      context.strokeStyle = "#64748b";
      context.lineWidth = Math.max(1.5, minSize * 0.045);
      context.beginPath();
      context.moveTo(0, -height / 2);
      context.lineTo(0, -height * 0.24);
      context.moveTo(0, height * 0.24);
      context.lineTo(0, height / 2);
      if (type === "floor-to-ceiling-ball") {
        context.moveTo(-width / 2, 0);
        context.lineTo(-width * 0.24, 0);
        context.moveTo(width * 0.24, 0);
        context.lineTo(width / 2, 0);
      }
      context.stroke();
    }

    if (type === "teardrop-bag" || type === "speed-ball") {
      context.beginPath();
      context.moveTo(0, -height / 2);
      context.bezierCurveTo(width * 0.45, -height * 0.12, width * 0.42, height * 0.42, 0, height / 2);
      context.bezierCurveTo(-width * 0.42, height * 0.42, -width * 0.45, -height * 0.12, 0, -height / 2);
      context.closePath();
      context.fillStyle = type === "speed-ball" ? "rgba(254, 226, 226, 0.86)" : "rgba(219, 234, 254, 0.82)";
      context.fill();
      context.strokeStyle = "#1f2937";
      context.stroke();
      return;
    }

    var radius = minSize * (type === "wrecking-ball-bag" ? 0.48 : 0.42);
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    if (type === "banana-bag") context.fillStyle = "rgba(254, 243, 199, 0.88)";
    if (type === "uppercut-bag") context.fillStyle = "rgba(254, 226, 226, 0.85)";
    if (type === "floor-to-ceiling-ball") context.fillStyle = "rgba(220, 252, 231, 0.86)";
    context.fill();
    context.strokeStyle = "#1f2937";
    context.stroke();

    if (type === "wrecking-ball-bag" || type === "uppercut-bag") {
      context.beginPath();
      context.arc(0, 0, radius * 0.55, 0, Math.PI * 2);
      context.strokeStyle = type === "uppercut-bag" ? "#dc2626" : "#64748b";
      context.stroke();
    } else if (type === "banana-bag") {
      context.beginPath();
      context.arc(-radius * 0.1, 0, radius * 0.62, -Math.PI * 0.45, Math.PI * 0.45);
      context.strokeStyle = "#d97706";
      context.stroke();
    } else {
      context.beginPath();
      context.arc(0, 0, Math.max(2, radius * 0.16), 0, Math.PI * 2);
      context.fillStyle = "#1f2937";
      context.fill();
    }
  }

  function isStorageEquipmentType(type) {
    return [
      "thai-pad-rack",
      "punch-mitt-rack",
      "kick-shield-rack",
      "belly-pad-storage",
      "glove-storage-shelves",
      "headgear-storage",
      "general-equipment-shelving",
      "mobile-equipment-cart",
      "open-storage-cabinet",
      "closed-storage-cabinet",
      "wall-pad-rack",
      "equipment-storage-zone"
    ].indexOf(type) >= 0;
  }

  function drawStorageEquipmentFixture(type, width, height) {
    var lineWidth = Math.max(1.5, Math.min(width, height) * 0.045);
    var inset = Math.max(2, Math.min(width, height) * 0.1);

    if (type === "equipment-storage-zone") {
      context.fillStyle = "rgba(219, 234, 254, 0.42)";
      context.strokeStyle = "#2563eb";
      context.lineWidth = Math.max(2, lineWidth);
      context.setLineDash([8, 6]);
      context.fillRect(-width / 2, -height / 2, width, height);
      context.strokeRect(-width / 2, -height / 2, width, height);
      context.setLineDash([]);
      context.beginPath();
      context.moveTo(-width * 0.22, 0);
      context.lineTo(width * 0.22, 0);
      context.lineTo(width * 0.14, -height * 0.08);
      context.moveTo(width * 0.22, 0);
      context.lineTo(width * 0.14, height * 0.08);
      context.stroke();
      return;
    }

    context.fillStyle = type === "mobile-equipment-cart" ? "rgba(219, 234, 254, 0.82)" : "rgba(248, 250, 252, 0.92)";
    context.strokeStyle = "#1f2937";
    context.lineWidth = lineWidth;
    roundRectPath(-width / 2, -height / 2, width, height, Math.min(8, inset));
    context.fill();
    context.stroke();

    if (type === "wall-pad-rack") {
      context.strokeStyle = "#111827";
      context.lineWidth = Math.max(3, lineWidth * 2);
      context.beginPath();
      context.moveTo(-width / 2, -height / 2);
      context.lineTo(width / 2, -height / 2);
      context.stroke();
      context.strokeStyle = "#dc2626";
      context.lineWidth = lineWidth;
      [-0.3, -0.1, 0.1, 0.3].forEach(function (position) {
        context.beginPath();
        context.moveTo(width * position, -height * 0.35);
        context.lineTo(width * position, height * 0.35);
        context.stroke();
      });
      return;
    }

    if (type === "closed-storage-cabinet" || type === "open-storage-cabinet" || type === "general-equipment-shelving") {
      context.strokeStyle = "#64748b";
      context.lineWidth = Math.max(1, lineWidth * 0.75);
      context.beginPath();
      context.moveTo(0, -height / 2);
      context.lineTo(0, height / 2);
      if (type !== "closed-storage-cabinet") {
        context.moveTo(-width / 2, 0);
        context.lineTo(width / 2, 0);
      }
      if (type === "general-equipment-shelving") {
        context.moveTo(-width / 2, -height * 0.25);
        context.lineTo(width / 2, -height * 0.25);
        context.moveTo(-width / 2, height * 0.25);
        context.lineTo(width / 2, height * 0.25);
      }
      context.stroke();
      if (type === "closed-storage-cabinet") {
        context.fillStyle = "#1f2937";
        context.beginPath();
        context.arc(-width * 0.08, 0, Math.max(2, lineWidth), 0, Math.PI * 2);
        context.arc(width * 0.08, 0, Math.max(2, lineWidth), 0, Math.PI * 2);
        context.fill();
      }
      return;
    }

    if (type === "mobile-equipment-cart") {
      context.strokeStyle = "#64748b";
      context.lineWidth = lineWidth;
      context.beginPath();
      context.moveTo(-width * 0.38, -height * 0.15);
      context.lineTo(width * 0.38, -height * 0.15);
      context.moveTo(-width * 0.38, height * 0.15);
      context.lineTo(width * 0.38, height * 0.15);
      context.stroke();
      context.fillStyle = "#1f2937";
      [-0.32, 0.32].forEach(function (position) {
        context.beginPath();
        context.arc(width * position, height * 0.46, Math.max(2, lineWidth * 1.2), 0, Math.PI * 2);
        context.fill();
      });
      return;
    }

    var markerCount = type === "thai-pad-rack" ? 3 : 2;
    for (var index = 0; index < markerCount; index += 1) {
      var centerX = markerCount === 3 ? width * (-0.28 + index * 0.28) : width * (-0.22 + index * 0.44);
      context.beginPath();
      if (type === "punch-mitt-rack" || type === "belly-pad-storage" || type === "headgear-storage") {
        context.ellipse(centerX, 0, width * 0.14, height * 0.3, 0, 0, Math.PI * 2);
      } else if (type === "glove-storage-shelves") {
        context.arc(centerX, 0, Math.min(width, height) * 0.16, 0, Math.PI * 2);
      } else {
        roundRectPath(centerX - width * 0.1, -height * 0.3, width * 0.2, height * 0.6, Math.max(2, inset * 0.4));
      }
      context.fillStyle = type === "kick-shield-rack" ? "rgba(254, 243, 199, 0.9)" : "rgba(219, 234, 254, 0.88)";
      context.fill();
      context.strokeStyle = "#64748b";
      context.lineWidth = Math.max(1, lineWidth * 0.7);
      context.stroke();
    }
  }

  function drawGymAreaFixture(width, height, visibleText) {
    var lineWidth = Math.max(2, Math.min(width, height) * 0.018);
    context.fillStyle = "rgba(209, 250, 229, 0.38)";
    context.strokeStyle = "#059669";
    context.lineWidth = lineWidth;
    context.setLineDash([10, 7]);
    context.fillRect(-width / 2, -height / 2, width, height);
    context.strokeRect(-width / 2, -height / 2, width, height);
    context.setLineDash([]);
    context.fillStyle = "#065f46";
    context.font = "600 " + Math.max(11, Math.min(18, Math.min(width, height) * 0.12)) + "px Segoe UI, Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(visibleText, 0, 0, Math.max(20, width - 16));
  }

  function isFacilityOrPeopleType(type) {
    return type.indexOf("facility-") === 0 ||
      type.indexOf("person-") === 0 ||
      type === "people-group" ||
      type.indexOf("mascot-") === 0;
  }

  function drawFacilityOrPeopleFixture(type, width, height) {
    var minSize = Math.min(width, height);
    var lineWidth = Math.max(1.5, minSize * 0.05);

    if (type === "facility-fan") {
      context.fillStyle = "rgba(248, 250, 252, 0.94)";
      context.strokeStyle = "#1f2937";
      context.lineWidth = lineWidth;
      context.beginPath();
      context.arc(0, 0, minSize * 0.46, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = "#bfdbfe";
      [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach(function (angle) {
        context.save();
        context.rotate(angle);
        context.beginPath();
        context.ellipse(minSize * 0.19, 0, minSize * 0.2, minSize * 0.09, -0.35, 0, Math.PI * 2);
        context.fill();
        context.restore();
      });
      context.fillStyle = "#1f2937";
      context.beginPath();
      context.arc(0, 0, Math.max(2, minSize * 0.07), 0, Math.PI * 2);
      context.fill();
      return;
    }

    if (type === "facility-trash-bin") {
      context.fillStyle = "rgba(226, 232, 240, 0.9)";
      context.strokeStyle = "#1f2937";
      context.lineWidth = lineWidth;
      context.beginPath();
      context.arc(0, 0, minSize * 0.43, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.beginPath();
      context.moveTo(-minSize * 0.18, -minSize * 0.18);
      context.lineTo(minSize * 0.18, minSize * 0.18);
      context.moveTo(minSize * 0.18, -minSize * 0.18);
      context.lineTo(-minSize * 0.18, minSize * 0.18);
      context.strokeStyle = "#64748b";
      context.stroke();
      return;
    }

    if (type.indexOf("person-") === 0) {
      context.fillStyle = type === "person-trainer" ? "#2563eb" : "#dc2626";
      drawPersonMarker(0, 0, minSize * 0.42, lineWidth);
      return;
    }

    if (type === "people-group") {
      var marker = Math.min(width, height) * 0.2;
      drawPersonMarker(-width * 0.24, -height * 0.18, marker, lineWidth);
      drawPersonMarker(width * 0.24, -height * 0.18, marker, lineWidth);
      drawPersonMarker(0, height * 0.22, marker, lineWidth);
      return;
    }

    if (type === "mascot-dog" || type === "mascot-cat") {
      context.fillStyle = type === "mascot-dog" ? "#d6a45d" : "#e2e8f0";
      context.strokeStyle = "#1f2937";
      context.lineWidth = lineWidth;
      context.beginPath();
      context.ellipse(width * 0.08, 0, width * 0.34, height * 0.34, 0, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.beginPath();
      context.arc(-width * 0.32, 0, minSize * 0.2, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      if (type === "mascot-cat") {
        context.beginPath();
        context.moveTo(-width * 0.43, -height * 0.12);
        context.lineTo(-width * 0.38, -height * 0.36);
        context.lineTo(-width * 0.27, -height * 0.17);
        context.fill();
      }
      context.beginPath();
      context.moveTo(width * 0.4, 0);
      context.bezierCurveTo(width * 0.6, -height * 0.25, width * 0.58, height * 0.3, width * 0.46, height * 0.28);
      context.stroke();
      return;
    }

    if (type === "facility-water-station") {
      context.fillStyle = "rgba(219, 234, 254, 0.92)";
    } else if (type === "facility-bench" || type === "facility-desk" || type === "facility-reception-counter") {
      context.fillStyle = "rgba(214, 164, 93, 0.86)";
    } else {
      context.fillStyle = "rgba(248, 250, 252, 0.94)";
    }
    context.strokeStyle = "#1f2937";
    context.lineWidth = lineWidth;
    roundRectPath(-width / 2, -height / 2, width, height, Math.min(7, minSize * 0.16));
    context.fill();
    context.stroke();

    if (type === "facility-reception-counter") {
      context.fillStyle = "#ffffff";
      context.fillRect(width * 0.12, -height * 0.25, width * 0.38, height * 0.75);
      return;
    }
    if (type === "facility-chair") {
      context.strokeStyle = "#64748b";
      context.lineWidth = Math.max(2, lineWidth);
      context.beginPath();
      context.moveTo(-width * 0.38, height * 0.34);
      context.lineTo(width * 0.38, height * 0.34);
      context.stroke();
      return;
    }
    if (type === "facility-locker" || type === "facility-open-shelving") {
      context.strokeStyle = "#64748b";
      context.lineWidth = Math.max(1, lineWidth * 0.7);
      context.beginPath();
      context.moveTo(0, -height / 2);
      context.lineTo(0, height / 2);
      context.moveTo(-width / 2, 0);
      context.lineTo(width / 2, 0);
      context.stroke();
      return;
    }
    if (type === "facility-mirror") {
      context.strokeStyle = "#ffffff";
      context.lineWidth = Math.max(2, lineWidth);
      context.beginPath();
      context.moveTo(-width * 0.3, height * 0.25);
      context.lineTo(-width * 0.05, -height * 0.25);
      context.moveTo(width * 0.05, height * 0.25);
      context.lineTo(width * 0.3, -height * 0.25);
      context.stroke();
      return;
    }
    if (type === "facility-training-screen") {
      context.fillStyle = "#1f2937";
      context.fillRect(-width * 0.42, -height * 0.32, width * 0.84, height * 0.64);
      context.fillStyle = "#ffffff";
      context.beginPath();
      context.moveTo(-width * 0.08, -height * 0.16);
      context.lineTo(width * 0.18, 0);
      context.lineTo(-width * 0.08, height * 0.16);
      context.closePath();
      context.fill();
      return;
    }
    if (type === "facility-air-conditioning") {
      context.strokeStyle = "#60a5fa";
      context.lineWidth = Math.max(1.5, lineWidth * 0.8);
      [-0.16, 0, 0.16].forEach(function (position) {
        context.beginPath();
        context.moveTo(-width * 0.34, height * position);
        context.lineTo(width * 0.34, height * position);
        context.stroke();
      });
    }
  }

  function drawPersonMarker(x, y, radius, lineWidth) {
    context.save();
    context.translate(x, y);
    context.strokeStyle = "#1f2937";
    context.lineWidth = lineWidth;
    context.beginPath();
    context.arc(0, -radius * 0.28, radius * 0.32, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.ellipse(0, radius * 0.25, radius * 0.72, radius * 0.46, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
  }

  function drawSelectionCorners(width, height) {
    var size = 8;
    var corners = [
      { x: -width / 2, y: -height / 2 },
      { x: width / 2, y: -height / 2 },
      { x: width / 2, y: height / 2 },
      { x: -width / 2, y: height / 2 }
    ];
    context.fillStyle = "#1d4ed8";
    corners.forEach(function (corner) {
      context.fillRect(corner.x - size / 2, corner.y - size / 2, size, size);
    });
  }

  function drawCoverImage(image, x, y, width, height) {
    var destinationRatio = width / height;
    var sourceRatio = image.width / image.height;
    var sourceWidth = image.width;
    var sourceHeight = image.height;
    var sourceX = 0;
    var sourceY = 0;

    if (sourceRatio > destinationRatio) {
      sourceWidth = image.height * destinationRatio;
      sourceX = (image.width - sourceWidth) / 2;
    } else {
      sourceHeight = image.width / destinationRatio;
      sourceY = (image.height - sourceHeight) / 2;
    }

    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  }

  function drawMeasurements() {
    var x = state.offsetX;
    var y = state.offsetY;
    var width = gymWidthPixels();
    var height = gymLengthPixels();
    var topY = y - 34;
    var leftX = x - 34;

    context.save();
    context.strokeStyle = "#1d4ed8";
    context.fillStyle = "#1d4ed8";
    context.lineWidth = 1.5;
    context.font = "12px Segoe UI, Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";

    context.beginPath();
    context.moveTo(x, topY);
    context.lineTo(x + width, topY);
    context.moveTo(x, topY - 7);
    context.lineTo(x, topY + 7);
    context.moveTo(x + width, topY - 7);
    context.lineTo(x + width, topY + 7);
    context.stroke();
    drawArrow(x + 12, topY, x, topY);
    drawArrow(x + width - 12, topY, x + width, topY);
    context.fillText(formatNumber(state.gymWidthMeters) + " m", x + width / 2, topY - 12);

    context.save();
    context.translate(leftX, y + height / 2);
    context.rotate(-Math.PI / 2);
    context.beginPath();
    context.moveTo(-height / 2, 0);
    context.lineTo(height / 2, 0);
    context.moveTo(-height / 2, -7);
    context.lineTo(-height / 2, 7);
    context.moveTo(height / 2, -7);
    context.lineTo(height / 2, 7);
    context.stroke();
    drawArrow(-height / 2 + 12, 0, -height / 2, 0);
    drawArrow(height / 2 - 12, 0, height / 2, 0);
    context.fillText(formatNumber(state.gymLengthMeters) + " m", 0, -12);
    context.restore();
    context.restore();
  }

  function drawArrow(fromX, fromY, toX, toY) {
    var angle = Math.atan2(toY - fromY, toX - fromX);
    var head = 7;
    context.beginPath();
    context.moveTo(fromX, fromY);
    context.lineTo(toX, toY);
    context.moveTo(toX, toY);
    context.lineTo(toX - head * Math.cos(angle - Math.PI / 6), toY - head * Math.sin(angle - Math.PI / 6));
    context.moveTo(toX, toY);
    context.lineTo(toX - head * Math.cos(angle + Math.PI / 6), toY - head * Math.sin(angle + Math.PI / 6));
    context.stroke();
  }

  function drawScaleBadge() {
    var text = "Internal scale: 1 m = " + Math.round(BASE_PIXELS_PER_METER * state.zoom) + " px";
    context.save();
    context.font = "12px Segoe UI, Arial, sans-serif";
    var metrics = context.measureText(text);
    var badgeWidth = metrics.width + 20;
    var badgeHeight = 30;
    var x = 16;
    var y = stage.clientHeight - badgeHeight - 16;
    context.fillStyle = "rgba(255, 255, 255, 0.92)";
    context.strokeStyle = "#d9d9de";
    context.lineWidth = 1;
    roundRect(x, y, badgeWidth, badgeHeight, 15);
    context.fill();
    context.stroke();
    context.fillStyle = "#111111";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(text, x + 10, y + badgeHeight / 2);
    context.restore();
  }

  function drawGuides() {
    if (!state.guides.length) return;
    context.save();
    context.strokeStyle = "#1d4ed8";
    context.lineWidth = 1.25;
    context.setLineDash([6, 6]);
    state.guides.forEach(function (guide) {
      if (guide.axis === "x") {
        var screenX = state.offsetX + metersToPixels(guide.value);
        context.beginPath();
        context.moveTo(screenX, state.offsetY);
        context.lineTo(screenX, state.offsetY + gymLengthPixels());
        context.stroke();
      } else {
        var screenY = state.offsetY + metersToPixels(guide.value);
        context.beginPath();
        context.moveTo(state.offsetX, screenY);
        context.lineTo(state.offsetX + gymWidthPixels(), screenY);
        context.stroke();
      }
    });
    context.restore();
  }

  function drawMarquee() {
    if (!state.interaction || state.interaction.type !== "marquee") return;
    var rect = normalizedRect(
      state.interaction.startClientX,
      state.interaction.startClientY,
      state.interaction.currentClientX,
      state.interaction.currentClientY
    );
    var canvasRect = canvas.getBoundingClientRect();

    context.save();
    context.fillStyle = "rgba(29, 78, 216, 0.12)";
    context.strokeStyle = "#1d4ed8";
    context.lineWidth = 1.2;
    context.fillRect(rect.left - canvasRect.left, rect.top - canvasRect.top, rect.right - rect.left, rect.bottom - rect.top);
    context.strokeRect(rect.left - canvasRect.left, rect.top - canvasRect.top, rect.right - rect.left, rect.bottom - rect.top);
    context.restore();
  }

  function roundRectPath(x, y, width, height, radius) {
    var safeRadius = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + safeRadius, y);
    context.arcTo(x + width, y, x + width, y + height, safeRadius);
    context.arcTo(x + width, y + height, x, y + height, safeRadius);
    context.arcTo(x, y + height, x, y, safeRadius);
    context.arcTo(x, y, x + width, y, safeRadius);
    context.closePath();
  }

  function roundRect(x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + width, y, x + width, y + height, radius);
    context.arcTo(x + width, y + height, x, y + height, radius);
    context.arcTo(x, y + height, x, y, radius);
    context.arcTo(x, y, x + width, y, radius);
    context.closePath();
  }

  function render() {
    context.clearRect(0, 0, stage.clientWidth, stage.clientHeight);
    drawGrid();
    drawGymOutline();
    drawPlacedItems();
    drawGuides();
    drawMeasurements();
    drawScaleBadge();
    drawMarquee();
  }

  function applyQuickArea(area) {
    var side = Math.sqrt(area);
    applyDimensions(side, side, true);
  }

  function handleKeyboardShortcuts(event) {
    var isInput = event.target && /input|textarea|select/i.test(event.target.tagName);
    if (isInput) return;

    var meta = event.metaKey || event.ctrlKey;

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteSelection();
      return;
    }

    if (meta && event.key.toLowerCase() === "c") {
      event.preventDefault();
      copySelection();
      return;
    }

    if (meta && event.key.toLowerCase() === "v") {
      event.preventDefault();
      pasteSelection();
      return;
    }

    if (meta && event.key.toLowerCase() === "d") {
      event.preventDefault();
      duplicateSelection();
      return;
    }

    if (meta && event.key.toLowerCase() === "z" && !event.shiftKey) {
      event.preventDefault();
      undo();
      return;
    }

    if ((meta && event.key.toLowerCase() === "y") || (meta && event.shiftKey && event.key.toLowerCase() === "z")) {
      event.preventDefault();
      redo();
    }
  }

  sizeForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var widthMeters = parseFloat(widthInput.value);
    var lengthMeters = parseFloat(lengthInput.value);
    if (!isFinite(widthMeters) || !isFinite(lengthMeters)) return;
    applyDimensions(widthMeters, lengthMeters, true);
  });

  quickButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      applyQuickArea(Number(button.getAttribute("data-area")));
    });
  });

  zoomInButton.addEventListener("click", function () {
    zoomAroundPoint(state.zoom * 1.2, stage.clientWidth / 2, stage.clientHeight / 2);
  });

  zoomOutButton.addEventListener("click", function () {
    zoomAroundPoint(state.zoom / 1.2, stage.clientWidth / 2, stage.clientHeight / 2);
  });

  fitButton.addEventListener("click", function () {
    fitToView();
  });

  resetButton.addEventListener("click", function () {
    state.zoom = 1;
    centerGym();
    syncReadouts();
    render();
  });

  undoButton.addEventListener("click", undo);
  redoButton.addEventListener("click", redo);
  copyButton.addEventListener("click", copySelection);
  pasteButton.addEventListener("click", pasteSelection);
  duplicateButton.addEventListener("click", duplicateSelection);
  deleteButton.addEventListener("click", deleteSelection);
  rotateLeftButton.addEventListener("click", function () { rotateSelection(-15); });
  rotateRightButton.addEventListener("click", function () { rotateSelection(15); });
  frontButton.addEventListener("click", bringSelectionToFront);
  backButton.addEventListener("click", sendSelectionToBack);
  snapButton.addEventListener("click", function () {
    state.snapToGrid = !state.snapToGrid;
    syncEditorControls();
  });
  multiSelectButton.addEventListener("click", function () {
    state.multiSelectMode = !state.multiSelectMode;
    syncEditorControls();
  });

  canvas.addEventListener("wheel", function (event) {
    event.preventDefault();
    var factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
    zoomAroundPoint(state.zoom * factor, event.offsetX, event.offsetY);
  }, { passive: false });

  canvas.addEventListener("pointerdown", beginCanvasInteraction);
  canvas.addEventListener("pointermove", updateCanvasInteraction);
  canvas.addEventListener("pointerup", finishCanvasInteraction);
  canvas.addEventListener("pointercancel", finishCanvasInteraction);

  window.addEventListener("keydown", handleKeyboardShortcuts);
  window.addEventListener("resize", resizeCanvas);

  preloadLibraryImages();
  renderLibrary();
  syncInputs();
  syncReadouts();
  syncEditorControls();
  resizeCanvas();
  fitToView();
})();
