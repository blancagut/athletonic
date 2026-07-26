import type { GymDesign } from '../domain/types'
import { EQUIPMENT } from '../catalog/equipment'

function timestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('The 3D view could not be captured.')), type, quality)
  })
}

export async function prepareGymCanvas() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  const canvas = document.querySelector<HTMLCanvasElement>('#gym-design-canvas canvas')
  if (!canvas || canvas.width < 2 || canvas.height < 2) throw new Error('The 3D view is not ready yet. Please try again.')
  return canvas
}

export async function downloadGymPng(canvas: HTMLCanvasElement) {
  const blob = await canvasBlob(canvas, 'image/png')
  downloadBlob(blob, `athletonic-gym-${timestamp()}.png`)
}

export function downloadGymJson(design: GymDesign) {
  const blob = new Blob([JSON.stringify(design, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `athletonic-gym-${timestamp()}.json`)
}

export async function downloadGymPdf(canvas: HTMLCanvasElement, design: GymDesign) {
  const [{ jsPDF }, imageBlob] = await Promise.all([
    import('jspdf'),
    canvasBlob(canvas, 'image/jpeg', 0.94),
  ])
  const imageUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () => reject(new Error('The captured view could not be added to the PDF.')))
    reader.readAsDataURL(imageBlob)
  })

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 12
  const imageWidth = pageWidth - margin * 2
  const imageHeight = Math.min(pageHeight - 42, imageWidth * canvas.height / canvas.width)

  pdf.setProperties({ title: 'Atheltonic Gym Design', subject: 'Gym configurator export', creator: 'Atheltonic Gym Configurator' })
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text('ATHELTONIC GYM DESIGN', margin, 14)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(90)
  pdf.text(`Generated ${new Date().toLocaleString()}`, pageWidth - margin, 14, { align: 'right' })
  pdf.addImage(imageUrl, 'JPEG', margin, 20, imageWidth, imageHeight, undefined, 'FAST')

  pdf.addPage('a4', 'portrait')
  const portraitWidth = pdf.internal.pageSize.getWidth()
  pdf.setTextColor(25)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(17)
  pdf.text('DESIGN SUMMARY', margin, 18)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  const floor = design.floor ?? { primary: 'black', border: 'blue' }
  const summary = [
    `Room: ${design.room.width.toFixed(1)} m x ${design.room.depth.toFixed(1)} m x ${design.room.height.toFixed(1)} m`,
    `Area: ${(design.room.width * design.room.depth).toFixed(1)} m2`,
    `Tatami: ${floor.primary} training area / ${floor.border} perimeter`,
    `Equipment: ${design.equipment.filter((item) => !item.mountedTo).length} placed items`,
    `Client logos: ${(design.placedLogos ?? []).length} placed copies`,
  ]
  summary.forEach((line, index) => pdf.text(line, margin, 30 + index * 7))

  pdf.setFont('helvetica', 'bold')
  pdf.text('EQUIPMENT LIST', margin, 72)
  pdf.setFont('helvetica', 'normal')
  const counts = new Map<string, number>()
  design.equipment.filter((item) => !item.mountedTo).forEach((item) => {
    const name = EQUIPMENT[item.kind].name
    counts.set(name, (counts.get(name) ?? 0) + 1)
  })
  let y = 82
  for (const [name, count] of counts) {
    if (y > 278) {
      pdf.addPage()
      y = 20
    }
    pdf.text(`${count} x ${name}`, margin, y)
    y += 6
  }
  if (y > 276) {
    pdf.addPage()
    y = 20
  }
  pdf.setFontSize(8)
  pdf.setTextColor(100)
  pdf.text('Planning visualization. Confirm final dimensions, clearances, structure, and installation with qualified professionals.', portraitWidth / 2, Math.min(y + 8, 290), { align: 'center', maxWidth: portraitWidth - margin * 2 })
  pdf.save(`athletonic-gym-${timestamp()}.pdf`)
}