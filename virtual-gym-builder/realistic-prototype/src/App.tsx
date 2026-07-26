import { BoxSelect, Check, Download, Grid3X3, ImagePlus, Minus, Move3D, Palette, Plus, RotateCcw, RotateCw, Save, Trash2, Undo2, View } from 'lucide-react'
import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import './App.css'
import { CATEGORIES, EQUIPMENT } from './catalog/equipment'
import { EquipmentSilhouette } from './components/EquipmentSilhouette'
import { compatibleEquipment, ensureRackConfiguration, rackDimensions, rackWarnings } from './domain/racks'
import type { EquipmentKind, FloorColor, LogoPlacementSurface, RoomArchitecture, RoomLayout } from './domain/types'
import { GymScene } from './scene/GymScene'
import { DEFAULT_ARCHITECTURE, useGymStore } from './state/gymStore'
import { downloadGymJson, downloadGymPdf, downloadGymPng, prepareGymCanvas } from './utils/exportGym'

const FLOOR_SWATCHES: Array<{ id: FloorColor; label: string; hex: string }> = [
  { id: 'black', label: 'Black', hex: '#161a19' },
  { id: 'graphite', label: 'Graphite', hex: '#343a38' },
  { id: 'gray', label: 'Gray', hex: '#858b88' },
  { id: 'white', label: 'White', hex: '#e9ece8' },
  { id: 'navy', label: 'Navy', hex: '#172b4d' },
  { id: 'blue', label: 'Blue', hex: '#1757a6' },
  { id: 'cyan', label: 'Cyan', hex: '#159eb3' },
  { id: 'green', label: 'Green', hex: '#247348' },
  { id: 'lime', label: 'Lime', hex: '#9cbd24' },
  { id: 'yellow', label: 'Yellow', hex: '#e0ba24' },
  { id: 'orange', label: 'Orange', hex: '#d66a25' },
  { id: 'red', label: 'Red', hex: '#b72e2b' },
  { id: 'purple', label: 'Purple', hex: '#694a8e' },
  { id: 'pink', label: 'Pink', hex: '#c65079' },
]

const ROOM_LAYOUTS: Array<{ id: RoomLayout; label: string }> = [
  { id: 'rectangular', label: 'Rectangle' },
  { id: 'square', label: 'Square' },
  { id: 'custom', label: 'Custom' },
]

const HIDDEN_CATALOG_KINDS = new Set<EquipmentKind>(['speed-bag-platform', 'double-end-system'])
const FIXED_BAG_RACK_KINDS = new Set<EquipmentKind>(['bag-rack-1', 'bag-rack-3', 'bag-rack-4'])

function CatalogVisual({ kind }: { kind: EquipmentKind }) {
  return (
    <span className={`equipment-icon equipment-icon--${kind}`}>
      <EquipmentSilhouette kind={kind} />
    </span>
  )
}

function LogoRangeControl({ label, value, min, max, step, suffix = 'm', onChange }: { label: string; value: number; min: number; max: number; step: number; suffix?: string; onChange: (value: number) => void }) {
  return <label className="logo-range-control"><span>{label}<output>{value.toFixed(step < 1 ? 2 : 0)}{suffix}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>
}

function RoomDimensionControl({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const update = (next: number) => onChange(Math.max(8, Math.min(80, Math.round(next * 2) / 2)))
  return (
    <div className="room-dimension-control">
      <div><span>{label}</span><output>{value.toFixed(1)} m</output></div>
      <input aria-label={`${label} in meters`} type="range" min="8" max="80" step="0.5" value={value} onChange={(event) => update(Number(event.target.value))} />
      <div className="dimension-stepper">
        <button aria-label={`Reduce ${label.toLowerCase()}`} onClick={() => update(value - 0.5)}><Minus size={13} /></button>
        <input aria-label={`${label} exact value`} type="number" min="8" max="80" step="0.5" value={value} onChange={(event) => update(Number(event.target.value))} />
        <button aria-label={`Increase ${label.toLowerCase()}`} onClick={() => update(value + 0.5)}><Plus size={13} /></button>
      </div>
    </div>
  )
}

function App() {
  const design = useGymStore((state) => state.design)
  const selectedId = useGymStore((state) => state.selectedId)
  const selectedStationId = useGymStore((state) => state.selectedStationId)
  const view = useGymStore((state) => state.view)
  const transformMode = useGymStore((state) => state.transformMode)
  const setView = useGymStore((state) => state.setView)
  const setTransformMode = useGymStore((state) => state.setTransformMode)
  const setRoom = useGymStore((state) => state.setRoom)
  const setRoomLayout = useGymStore((state) => state.setRoomLayout)
  const setAreaUnit = useGymStore((state) => state.setAreaUnit)
  const setArchitectureOption = useGymStore((state) => state.setArchitectureOption)
  const addArchitectureElement = useGymStore((state) => state.addArchitectureElement)
  const toggleWalls = useGymStore((state) => state.toggleWalls)
  const setLogo = useGymStore((state) => state.setLogo)
  const addPlacedLogo = useGymStore((state) => state.addPlacedLogo)
  const selectedLogoId = useGymStore((state) => state.selectedLogoId)
  const setSelectedLogoId = useGymStore((state) => state.setSelectedLogoId)
  const updatePlacedLogo = useGymStore((state) => state.updatePlacedLogo)
  const duplicatePlacedLogo = useGymStore((state) => state.duplicatePlacedLogo)
  const deletePlacedLogo = useGymStore((state) => state.deletePlacedLogo)
  const setFloorColor = useGymStore((state) => state.setFloorColor)
  const setEquipmentCustomization = useGymStore((state) => state.setEquipmentCustomization)
  const addEquipment = useGymStore((state) => state.addEquipment)
  const assignRackEquipment = useGymStore((state) => state.assignRackEquipment)
  const removeRackEquipment = useGymStore((state) => state.removeRackEquipment)
  const setLinearStationCount = useGymStore((state) => state.setLinearStationCount)
  const setRackSpacing = useGymStore((state) => state.setRackSpacing)
  const rotateSelected = useGymStore((state) => state.rotateSelected)
  const deleteSelected = useGymStore((state) => state.deleteSelected)
  const resetTemplate = useGymStore((state) => state.resetTemplate)
  const fileInput = useRef<HTMLInputElement>(null)
  const equipmentLogoInput = useRef<HTMLInputElement>(null)
  const [savedNotice, setSavedNotice] = useState(false)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [assignmentError, setAssignmentError] = useState<string | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [rackStationCount, setRackStationCount] = useState(4)
  const [equipmentLogoZone, setEquipmentLogoZone] = useState<'center' | 'sides' | 'corners'>('center')
  const [logoDestination, setLogoDestination] = useState('floor')
  const selected = design.equipment.find((item) => item.id === selectedId)
  const selectedArchitecture = design.architectureElements?.find((item) => item.id === selectedId)
  const selectedLogo = design.placedLogos?.find((logo) => logo.id === selectedLogoId)
  const selectedDefinition = selected ? EQUIPMENT[selected.kind] : null
  const selectedRack = selected ? ensureRackConfiguration(selected) : undefined
  const selectedRackDimensions = selectedRack ? rackDimensions(selectedRack) : null
  const selectedRackWarnings = selected && selectedRack ? rackWarnings(selected, design.equipment, design.room) : []
  const floor = design.floor ?? { primary: 'black' as FloorColor, border: 'blue' as FloorColor }
  const roomLayout = design.room.layout ?? 'custom'
  const areaUnit = design.room.areaUnit ?? 'sqm'
  const areaSquareMeters = design.room.width * design.room.depth
  const displayedArea = areaUnit === 'sqm' ? areaSquareMeters : areaSquareMeters * 10.7639
  const architecture = { ...DEFAULT_ARCHITECTURE, ...design.architecture }

  const setRoomDimension = (dimension: 'width' | 'depth', value: number) => {
    setRoomLayout('custom')
    setRoom(dimension === 'width' ? value : design.room.width, dimension === 'depth' ? value : design.room.depth)
  }

  const handleLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setLogoError('Use a PNG, JPEG, or WebP image.')
      event.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('Logo must be 5 MB or smaller.')
      event.target.value = ''
      return
    }

    setLogoError(null)
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      const dataUrl = String(reader.result)
      setLogo(dataUrl)
      addPlacedLogo(dataUrl, 'floor')
      event.target.value = ''
    })
    reader.addEventListener('error', () => setLogoError('The logo could not be read. Try another file.'))
    reader.readAsDataURL(file)
  }

  const handleEquipmentLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !selected) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setLogoError('Use a PNG, JPEG, or WebP image up to 5 MB.')
      event.target.value = ''
      return
    }
    const selectedId = selected.id
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      setEquipmentCustomization(selectedId, { logos: { [equipmentLogoZone]: String(reader.result) } })
      setLogoError(null)
      event.target.value = ''
    })
    reader.addEventListener('error', () => setLogoError('The logo could not be read. Try another file.'))
    reader.readAsDataURL(file)
  }

  const chooseEquipmentLogo = (zone: 'center' | 'sides' | 'corners') => {
    setEquipmentLogoZone(zone)
    equipmentLogoInput.current?.click()
  }

  const removeEquipmentLogo = (zone: 'center' | 'sides' | 'corners') => {
    if (!selected) return
    setEquipmentCustomization(selected.id, { logos: { [zone]: undefined } })
  }

  const parseLogoDestination = (value: string): { surface: LogoPlacementSurface; targetId?: string } => {
    const [surface, targetId] = value.split(':')
    return { surface: surface as LogoPlacementSurface, targetId }
  }

  const addLogoCopy = () => {
    if (!design.logoDataUrl) return
    const destination = parseLogoDestination(logoDestination)
    addPlacedLogo(design.logoDataUrl, destination.surface, destination.targetId)
  }

  const moveSelectedLogoTo = (value: string) => {
    if (!selectedLogo) return
    const destination = parseLogoDestination(value)
    updatePlacedLogo(selectedLogo.id, { ...destination, u: 0, v: destination.surface.startsWith('wall-') ? 1.5 : 0 })
  }

  const showSaved = () => {
    setSavedNotice(true)
    window.setTimeout(() => setSavedNotice(false), 1800)
  }

  const exportGym = async (format: 'png' | 'pdf' | 'json') => {
    try {
      setExportStatus(`Preparing ${format.toUpperCase()}...`)
      if (format === 'json') downloadGymJson(design)
      else {
        const canvas = await prepareGymCanvas()
        if (format === 'png') await downloadGymPng(canvas)
        else await downloadGymPdf(canvas, design)
      }
      setExportStatus(`${format.toUpperCase()} downloaded`)
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : 'Export failed. Please try again.')
    }
    window.setTimeout(() => setExportStatus(null), 2800)
  }

  const changeStationCount = (nextCount: number) => {
    if (!selected || !selectedRack) return
    const removedOccupied = selectedRack.stations.slice(nextCount).some((station) => station.mountedEquipmentId)
    if (removedOccupied && !window.confirm('Removed stations contain equipment. Continue and place that equipment beside the rack?')) return
    setLinearStationCount(selected.id, nextCount)
  }

  const assignEquipment = (stationId: string, kind: EquipmentKind) => {
    if (!selected) return
    setAssignmentError(assignRackEquipment(selected.id, stationId, kind))
  }

  useEffect(() => {
    const handleDeleteShortcut = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select'))) return
      const state = useGymStore.getState()
      if (!state.selectedId && !state.selectedLogoId) return
      event.preventDefault()
      if (state.selectedLogoId) state.deletePlacedLogo(state.selectedLogoId)
      else state.deleteSelected()
    }
    window.addEventListener('keydown', handleDeleteShortcut)
    return () => window.removeEventListener('keydown', handleDeleteShortcut)
  }, [])

  return (
    <main className="studio-shell">
      <header className="topbar">
        <div className="brand-block">
          <img className="brand-mark" src={`${import.meta.env.BASE_URL}athletonic-logo.svg`} alt="" />
          <span><span className="brand-title"><strong>Atheltonic</strong><b>BETA</b></span><small>Gym configurator</small></span>
        </div>
        <div className="top-actions">
          <button className="icon-button" title="Reset current template" onClick={resetTemplate}><Undo2 size={17} /></button>
          <details className="export-menu">
            <summary><Download size={16} /> Export</summary>
            <div>
              <button onClick={() => void exportGym('png')}><strong>PNG image</strong><small>Current 3D view</small></button>
              <button onClick={() => void exportGym('pdf')}><strong>PDF report</strong><small>Image + design summary</small></button>
              <button onClick={() => void exportGym('json')}><strong>Design JSON</strong><small>Technical backup</small></button>
            </div>
          </details>
          <button className="save-button" onClick={showSaved}><Save size={16} /> {savedNotice ? 'Saved' : 'Save local'}</button>
        </div>
        {exportStatus && <div className="export-status" role="status">{exportStatus}</div>}
      </header>

      <section className="workspace">
        <aside className="library-panel">
          <div className="panel-title"><span>Equipment library</span><strong>Generic planning equipment</strong></div>
          <div className="catalog-scroll">
            {CATEGORIES.map((category) => (
              <section className="catalog-section" key={category}>
                <h2>{category}</h2>
                {Object.values(EQUIPMENT).filter((item) => item.category === category && !HIDDEN_CATALOG_KINDS.has(item.kind)).map((item) => item.kind === 'bag-rack-2' ? (
                  <div className="catalog-item rack-builder" key={item.kind}>
                    <CatalogVisual kind={item.kind} />
                    <span><strong>{item.name}</strong><small>{item.description}</small></span>
                    <label>
                      <span>Stations</span>
                      <input aria-label="Build your own rack station count" type="number" min="1" max="20" value={rackStationCount} onChange={(event) => setRackStationCount(Math.max(1, Math.min(20, Math.floor(Number(event.target.value) || 1))))} />
                    </label>
                    <button onClick={() => addEquipment(item.kind, rackStationCount)}>Build rack</button>
                  </div>
                ) : (
                  <button className="catalog-item" key={item.kind} onClick={() => addEquipment(item.kind)}>
                    <CatalogVisual kind={item.kind} />
                    <span><strong>{item.name}</strong><small>{FIXED_BAG_RACK_KINDS.has(item.kind) ? `${item.description} · assign each station after adding` : item.description}</small></span>
                    <span className="add-symbol">{FIXED_BAG_RACK_KINDS.has(item.kind) ? '→' : '+'}</span>
                  </button>
                ))}
              </section>
            ))}
          </div>
        </aside>

        <section className="stage" aria-label="Interactive gym scene">
          <GymScene />
          <div className="view-switcher" aria-label="View mode">
            <button className={view === 'top' ? 'is-active' : ''} onClick={() => setView('top')}><Grid3X3 size={16} /> Top</button>
            <button className={view === 'perspective' ? 'is-active' : ''} onClick={() => setView('perspective')}><View size={16} /> 3D</button>
          </div>
          <div className="scene-tools">
            <button className={transformMode === 'translate' ? 'is-active' : ''} title="Move selected equipment" aria-label="Move selected equipment" aria-pressed={transformMode === 'translate'} onClick={() => setTransformMode('translate')}><Move3D size={17} /></button>
            <button className={transformMode === 'rotate' ? 'is-active' : ''} title="Rotate selected equipment" aria-label="Rotate selected equipment" aria-pressed={transformMode === 'rotate'} onClick={() => setTransformMode('rotate')}><RotateCw size={17} /></button>
            <button className={design.wallsVisible ? 'is-active' : ''} title="Toggle walls" aria-label="Toggle walls" aria-pressed={design.wallsVisible} onClick={toggleWalls}><BoxSelect size={17} /></button>
            {(selected || selectedArchitecture) && <button className="quick-delete" title="Delete selected object (Delete)" aria-label="Delete selected object" onClick={deleteSelected}><Trash2 size={17} /></button>}
          </div>
          {selected && transformMode === 'rotate' && (
            <div className="rotation-controls" role="toolbar" aria-label="Rotation controls">
              <button title="Rotate left 15 degrees" aria-label="Rotate left 15 degrees" onClick={() => rotateSelected(-Math.PI / 12)}><RotateCcw size={18} /><span>15°</span></button>
              <button className="finish-rotation" title="Finish rotation" aria-label="Finish rotation" onClick={() => setTransformMode('translate')}><Check size={18} /><span>Finish</span></button>
              <button title="Rotate right 15 degrees" aria-label="Rotate right 15 degrees" onClick={() => rotateSelected(Math.PI / 12)}><RotateCw size={18} /><span>15°</span></button>
            </div>
          )}
          <div className="scene-status">
            <span><i className="status-dot" /> Autosaved locally</span>
            <span>{design.room.width.toFixed(1)} × {design.room.depth.toFixed(1)} m</span>
            <span>{design.equipment.length} objects</span>
          </div>
        </section>

        <aside className="inspector-panel">
          <section className="inspector-section">
            <div className="section-heading"><span>Room</span><small>DESIGN & SIZE</small></div>
            <div className="room-layout-switcher" aria-label="Room design">
              {ROOM_LAYOUTS.map((layout) => (
                <button key={layout.id} className={roomLayout === layout.id ? 'is-active' : ''} onClick={() => setRoomLayout(layout.id)}>{layout.label}</button>
              ))}
            </div>
            <div className="room-size-controls">
              <RoomDimensionControl label="Width" value={design.room.width} onChange={(value) => setRoomDimension('width', value)} />
              <RoomDimensionControl label="Depth" value={design.room.depth} onChange={(value) => setRoomDimension('depth', value)} />
            </div>
            <div className="area-summary">
              <span><small>Total area</small><strong>{displayedArea.toLocaleString(undefined, { maximumFractionDigits: 1 })} {areaUnit === 'sqm' ? 'm²' : 'sq ft'}</strong></span>
              <div className="unit-switcher" aria-label="Area unit">
                <button className={areaUnit === 'sqm' ? 'is-active' : ''} onClick={() => setAreaUnit('sqm')}>m²</button>
                <button className={areaUnit === 'sqft' ? 'is-active' : ''} onClick={() => setAreaUnit('sqft')}>sq ft</button>
              </div>
            </div>
            <div className="architecture-controls">
              <div className="floor-title"><BoxSelect size={14} /><span>Room architecture</span></div>
              {([
                ['doors', 'EXIT + TOILET doors'],
                ['windows', 'Wall windows'],
                ['ceiling', 'Visible ceiling'],
                ['ledLighting', 'LED lighting'],
                ['columns', 'Structural columns'],
              ] as Array<[keyof RoomArchitecture, string]>).map(([option, label]) => (
                <label key={option} className="architecture-toggle">
                  <span>{label}</span>
                  <input type="checkbox" checked={architecture[option]} onChange={(event) => setArchitectureOption(option, event.target.checked)} />
                </label>
              ))}
              <div className="architecture-add-controls" aria-label="Add doors and windows">
                <button onClick={() => addArchitectureElement('window', 'north')}>+ North window</button>
                <button onClick={() => addArchitectureElement('window', 'west')}>+ West window</button>
                <button onClick={() => addArchitectureElement('exit-door', 'north')}>+ EXIT door</button>
                <button onClick={() => addArchitectureElement('toilet-door', 'west')}>+ TOILET door</button>
              </div>
            </div>
            <div className="floor-controls">
              <div className="floor-title"><Palette size={14} /><span>BJJ EVA tatami</span></div>
              <label>Training area</label>
              <div className="color-swatches">
                {FLOOR_SWATCHES.map((swatch) => (
                  <button
                    key={`primary-${swatch.id}`}
                    className={floor.primary === swatch.id ? 'is-active' : ''}
                    style={{ '--swatch': swatch.hex } as React.CSSProperties}
                    title={`${swatch.label} training area`}
                    aria-label={`${swatch.label} training area`}
                    onClick={() => setFloorColor('primary', swatch.id)}
                  />
                ))}
              </div>
              <label>Perimeter</label>
              <div className="color-swatches">
                {FLOOR_SWATCHES.map((swatch) => (
                  <button
                    key={`border-${swatch.id}`}
                    className={floor.border === swatch.id ? 'is-active' : ''}
                    style={{ '--swatch': swatch.hex } as React.CSSProperties}
                    title={`${swatch.label} perimeter`}
                    aria-label={`${swatch.label} perimeter`}
                    onClick={() => setFloorColor('border', swatch.id)}
                  />
                ))}
              </div>
              <small className="floor-note">Continuous training surface · 1 m perimeter</small>
              <small className="floor-note">Add each wrestling circle from Floor Markings, then place and color it individually.</small>
            </div>
          </section>

          <section className="inspector-section branding-section">
            <div className="section-heading"><span>Client branding</span></div>
            <button className="upload-zone" onClick={() => fileInput.current?.click()}>
              {design.logoDataUrl ? <img src={design.logoDataUrl} alt="Client logo preview" /> : <ImagePlus size={23} />}
              <span>{design.logoDataUrl ? 'Replace logo' : 'Upload logo'}</span>
              <small>PNG, JPEG, or WebP · max 5 MB</small>
            </button>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleLogo} />
            {logoError && <p className="upload-error" role="alert">{logoError}</p>}
            {design.logoDataUrl && <>
              <div className="logo-placement-adder">
                <select aria-label="New logo destination" value={logoDestination} onChange={(event) => setLogoDestination(event.target.value)}>
                  <option value="floor">Training floor</option>
                  <option value="wall-north">Back wall</option>
                  <option value="wall-west">Left wall</option>
                  {design.equipment.filter((item) => item.kind === 'boxing-ring').map((item, index) => <option key={item.id} value={`boxing-ring:${item.id}`}>Boxing ring {index + 1}</option>)}
                  {design.equipment.filter((item) => item.kind === 'mma-cage').map((item, index) => <option key={item.id} value={`mma-cage:${item.id}`}>MMA cage {index + 1}</option>)}
                </select>
                <button onClick={addLogoCopy}><Plus size={14} /> Add copy</button>
              </div>
              <div className="placed-logo-list">
                {(design.placedLogos ?? []).map((logo, index) => <button key={logo.id} className={selectedLogoId === logo.id ? 'is-active' : ''} onClick={() => setSelectedLogoId(logo.id)}><img src={logo.dataUrl} alt="" /><span>Logo {index + 1}<small>{logo.surface.replace('-', ' ')}</small></span></button>)}
              </div>
              {selectedLogo && <div className="placed-logo-editor">
                <div className="customization-heading"><strong>Selected logo</strong><small>Click any logo in the scene or list to edit it</small></div>
                <label className="logo-surface-select">Surface<select value={`${selectedLogo.surface}${selectedLogo.targetId ? `:${selectedLogo.targetId}` : ''}`} onChange={(event) => moveSelectedLogoTo(event.target.value)}>
                  <option value="floor">Training floor</option>
                  <option value="wall-north">Back wall</option>
                  <option value="wall-west">Left wall</option>
                  {design.equipment.filter((item) => item.kind === 'boxing-ring').map((item, index) => <option key={item.id} value={`boxing-ring:${item.id}`}>Boxing ring {index + 1}</option>)}
                  {design.equipment.filter((item) => item.kind === 'mma-cage').map((item, index) => <option key={item.id} value={`mma-cage:${item.id}`}>MMA cage {index + 1}</option>)}
                </select></label>
                <LogoRangeControl label={selectedLogo.surface.startsWith('wall-') ? 'Horizontal' : 'Position X'} value={selectedLogo.u} min={selectedLogo.surface === 'wall-west' ? -design.room.depth / 2 + .5 : selectedLogo.surface === 'boxing-ring' ? -2.7 : selectedLogo.surface === 'mma-cage' ? -3.8 : -design.room.width / 2 + .5} max={selectedLogo.surface === 'wall-west' ? design.room.depth / 2 - .5 : selectedLogo.surface === 'boxing-ring' ? 2.7 : selectedLogo.surface === 'mma-cage' ? 3.8 : design.room.width / 2 - .5} step={.1} onChange={(u) => updatePlacedLogo(selectedLogo.id, { u })} />
                <LogoRangeControl label={selectedLogo.surface.startsWith('wall-') ? 'Height' : 'Position Z'} value={selectedLogo.v} min={selectedLogo.surface.startsWith('wall-') ? .3 : selectedLogo.surface === 'boxing-ring' ? -2.7 : selectedLogo.surface === 'mma-cage' ? -3.8 : -design.room.depth / 2 + .5} max={selectedLogo.surface.startsWith('wall-') ? design.room.height - .3 : selectedLogo.surface === 'boxing-ring' ? 2.7 : selectedLogo.surface === 'mma-cage' ? 3.8 : design.room.depth / 2 - .5} step={.1} onChange={(v) => updatePlacedLogo(selectedLogo.id, { v })} />
                <div className="logo-size-control"><span>Size<output>{selectedLogo.size.toFixed(2)} m</output></span><div><button aria-label="Reduce logo size" onClick={() => updatePlacedLogo(selectedLogo.id, { size: Math.max(.25, selectedLogo.size - .25) })}><Minus size={13} /></button><input aria-label="Logo size" type="range" min={.25} max={4} step={.05} value={selectedLogo.size} onChange={(event) => updatePlacedLogo(selectedLogo.id, { size: Number(event.target.value) })} /><button aria-label="Increase logo size" onClick={() => updatePlacedLogo(selectedLogo.id, { size: Math.min(4, selectedLogo.size + .25) })}><Plus size={13} /></button></div></div>
                <LogoRangeControl label="Rotation" value={selectedLogo.rotation * 180 / Math.PI} min={-180} max={180} step={5} suffix="°" onChange={(degrees) => updatePlacedLogo(selectedLogo.id, { rotation: degrees * Math.PI / 180 })} />
                <div className="placed-logo-actions"><button onClick={() => duplicatePlacedLogo(selectedLogo.id)}><Plus size={13} /> Duplicate</button><button onClick={() => deletePlacedLogo(selectedLogo.id)}><Trash2 size={13} /> Delete</button></div>
              </div>}
              <button className="text-button" onClick={() => setLogo(null)}>Clear upload source</button>
            </>}
          </section>

          <section className="inspector-section selection-section">
            <div className="section-heading"><span>Selection</span></div>
            {selectedArchitecture ? (
              <div className="selected-card architectural-selection">
                <span><strong>{selectedArchitecture.kind === 'window' ? 'Wall window' : selectedArchitecture.kind === 'exit-door' ? 'EXIT door' : 'TOILET door'}</strong><small>Drag along the {selectedArchitecture.wall} wall · Delete to remove</small></span>
              </div>
            ) : selected && selectedDefinition ? (
              <>
                <div className="selected-card">
                  <span className={`equipment-icon equipment-icon--${selected.kind}`}><EquipmentSilhouette kind={selected.kind} /></span>
                  <span><strong>{selectedDefinition.name}</strong><small>Fixed real-world proportions</small></span>
                </div>
                <dl className="measure-list">
                  <div><dt>Width</dt><dd>{(selectedRackDimensions?.[0] ?? selectedDefinition.dimensions[0]).toFixed(2)} m</dd></div>
                  <div><dt>Depth</dt><dd>{(selectedRackDimensions?.[1] ?? selectedDefinition.dimensions[1]).toFixed(2)} m</dd></div>
                  <div><dt>Height</dt><dd>{(selectedRackDimensions?.[2] ?? selectedDefinition.dimensions[2]).toFixed(2)} m</dd></div>
                  <div><dt>Clearance</dt><dd>{selectedDefinition.clearance.toFixed(2)} m</dd></div>
                </dl>
                {selected.kind === 'wrestling-circle' && (
                  <div className="object-customization">
                    <div className="customization-heading"><strong>Circle color</strong><small>Move this 10 × 10 m bay directly in the scene</small></div>
                    <div className="color-swatches">
                      {FLOOR_SWATCHES.map((swatch) => <button key={swatch.id} className={(selected.customization?.markingColor ?? 'red') === swatch.id ? 'is-active' : ''} style={{ '--swatch': swatch.hex } as React.CSSProperties} title={swatch.label} aria-label={`${swatch.label} wrestling circle`} onClick={() => setEquipmentCustomization(selected.id, { markingColor: swatch.id })} />)}
                    </div>
                  </div>
                )}
                {(selected.kind === 'boxing-ring' || selected.kind === 'mma-cage') && (
                  <div className="object-customization">
                    <div className="customization-heading"><strong>Competition floor</strong><small>Only this structure changes</small></div>
                    <div className="color-swatches">
                      {FLOOR_SWATCHES.map((swatch) => <button key={swatch.id} className={(selected.customization?.surfaceColor ?? 'gray') === swatch.id ? 'is-active' : ''} style={{ '--swatch': swatch.hex } as React.CSSProperties} title={swatch.label} aria-label={`${swatch.label} competition floor`} onClick={() => setEquipmentCustomization(selected.id, { surfaceColor: swatch.id })} />)}
                    </div>
                    <div className="structure-logo-grid">
                      {([
                        ['center', 'Center canvas', '1 large placement'],
                        ['sides', 'Black apron', selected.kind === 'boxing-ring' ? '4 repeats on each side' : 'Repeated on all 8 sides'],
                        ['corners', 'Corner pads', selected.kind === 'boxing-ring' ? 'Top, center, bottom on all 4' : '3 repeats on all 8 posts'],
                      ] as const).map(([zone, label, placement]) => {
                        const image = selected.customization?.logos?.[zone]
                        return <div key={zone} className={`structure-logo-slot${image ? ' has-image' : ''}`}><button className="structure-logo-upload" onClick={() => chooseEquipmentLogo(zone)}>{image ? <img src={image} alt="" /> : <ImagePlus size={17} />}<span><strong>{label}</strong><small>{placement}</small></span></button>{image && <button className="structure-logo-remove" title={`Remove ${label.toLowerCase()} logo`} aria-label={`Remove ${label.toLowerCase()} logo`} onClick={() => removeEquipmentLogo(zone)}><Trash2 size={13} /></button>}</div>
                      })}
                    </div>
                    <small className="logo-format-note">Transparent PNG or WebP recommended. Photos retain their rectangular background.</small>
                    <input ref={equipmentLogoInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleEquipmentLogo} />
                  </div>
                )}
                {selectedRack && selected && (
                  <div className="rack-inspector">
                    <div className="rack-summary">
                      <span><small>Layout</small><strong>{selectedRack.layout}</strong></span>
                      <span><small>Stations</small><strong>{selectedRack.layout === 'double-end' ? 1 : selectedRack.stationCount}</strong></span>
                      <span><small>Operational area</small><strong>{((selectedRackDimensions?.[0] ?? 0) + selectedDefinition.clearance * 2).toFixed(1)} × {((selectedRackDimensions?.[1] ?? 0) + selectedDefinition.clearance * 2).toFixed(1)} m</strong></span>
                    </div>
                    {selectedRack.layout === 'linear' && (
                      <div className="rack-controls">
                        <label>Stations<div className="quantity-stepper"><button disabled={selectedRack.stationCount <= 1} onClick={() => changeStationCount(selectedRack.stationCount - 1)}>−</button><output>{selectedRack.stationCount}</output><button onClick={() => changeStationCount(selectedRack.stationCount + 1)}>+</button></div></label>
                        <label>Spacing · m<input type="number" min="1.2" max="5" step="0.1" value={selectedRack.stationSpacingMeters ?? 2.2} onChange={(event) => setRackSpacing(selected.id, Number(event.target.value))} /></label>
                        <small>Total structure length: {selectedRackDimensions?.[0].toFixed(2)} m</small>
                      </div>
                    )}
                    {selectedRackWarnings.length > 0 && <div className="rack-warnings">{selectedRackWarnings.map((warning) => <p key={`${warning.stationIds.join('-')}-${warning.message}`}>{warning.message}</p>)}</div>}
                    {assignmentError && <p className="assignment-error">{assignmentError}</p>}
                    <ol className="station-list">
                      {selectedRack.stations.filter((station) => station.mountType !== 'double-end-bottom').map((station, index) => {
                        const mounted = design.equipment.find((item) => item.id === station.mountedEquipmentId)
                        return (
                          <li key={station.id} className={selectedStationId === station.id ? 'is-selected' : ''}>
                            <div><span><strong>Station {index + 1}</strong><small>{station.mountType} · {station.maxLoadKg ? `${station.maxLoadKg} kg max` : 'load not published'}</small></span><em>{mounted ? EQUIPMENT[mounted.kind].name : 'Empty'}</em></div>
                            <div className="station-actions">
                              <select aria-label={`Equipment for station ${index + 1}`} value={mounted?.kind ?? ''} onChange={(event) => event.target.value && assignEquipment(station.id, event.target.value as EquipmentKind)}>
                                <option value="">Choose compatible equipment</option>
                                {['Heavy Bags', 'Black Leather Bags'].map((category) => {
                                  const kinds = compatibleEquipment(station.mountType).filter((kind) => EQUIPMENT[kind].category === category)
                                  return kinds.length > 0 ? <optgroup key={category} label={category}>{kinds.map((kind) => <option key={kind} value={kind}>{EQUIPMENT[kind].name}</option>)}</optgroup> : null
                                })}
                                {compatibleEquipment(station.mountType).filter((kind) => !['Heavy Bags', 'Black Leather Bags'].includes(EQUIPMENT[kind].category)).map((kind) => <option key={kind} value={kind}>{EQUIPMENT[kind].name}</option>)}
                              </select>
                              {mounted && <button onClick={() => removeRackEquipment(selected.id, station.id)}>Remove</button>}
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                  </div>
                )}
                <div className="selection-actions">
                  <button onClick={() => rotateSelected(-Math.PI / 12)}><RotateCw size={15} /> −15°</button>
                  <button onClick={() => rotateSelected(Math.PI / 12)}><RotateCw size={15} /> +15°</button>
                </div>
                <button className="delete-button" onClick={deleteSelected}><Trash2 size={16} /> Delete equipment</button>
              </>
            ) : (
              <div className="empty-selection"><BoxSelect size={24} /><span>Select an object in the scene</span></div>
            )}
          </section>
          <footer className="prototype-note"><Download size={14} /><span>Licensed GLB ready · provisional models shown when files are absent</span></footer>
        </aside>
      </section>
    </main>
  )
}

export default App
