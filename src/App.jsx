import { useEffect, useMemo, useState } from 'react'

const CLASS_INFO = [
  { id: 0, name: 'Edge', description: 'Looks for crisp boundary evidence.' },
  { id: 1, name: 'Texture', description: 'Looks for repeated local patterns.' },
  { id: 2, name: 'Blob', description: 'Looks for smoother regional structure.' },
]

const PATTERN_OPTIONS = [
  { id: 'ring', name: 'Ring + diagonals' },
  { id: 'checker', name: 'Checkerboard' },
  { id: 'bars', name: 'Bars' },
  { id: 'corners', name: 'Corners' },
  { id: 'blob', name: 'Soft blobs' },
]

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const flatten2D ] = (matrix) => matrix.flat()
const cloneMatrix = (matrix) => matrix.map((row) => [...row])

function maxAbs(values) {
  return values.reduce((best, value) => Math.max(best, Math.abs(value)), 0)
}

function normalizeArray(values) {
  const scale = maxAbs(values) || 1
  return values.map((value) => value / scale)
}

function normalizeMatrix(matrix) {
  const scale = maxAbs(flatten2D(matrix)) || 1
  return matrix.map((row) => row.map((value) => value / scale))
}

function resizeGrid(data, oldSize, newSize) {
  if (oldSize === newSize) return [...data]
  const resized = new Array(newSize * newSize).fill(0)
  for (let y = 0; y < newSize; y += 1) {
    for (let x = 0; x < newSize; x += 1) {
      const oldX = Math.floor((x / newSize) * oldSize)
      const oldY = Math.floor((y / newSize) * oldSize)
      resized[y * newSize + x] = data[oldY * oldSize + oldX] ?? 0
    }
  }
  return resized
}

function resizeKernelMatrix(matrix, newSize) {
  const oldSize = matrix.length
  if (oldSize === newSize) return cloneMatrix(matrix)
  const resized = Array.from({ length: newSize }, () => Array.from({ length: newSize }, () => 0))
  for (let y = 0; y < newSize; y += 1) {
    for (let x = 0; x < newSize; x += 1) {
      const oldX = Math.floor((x / newSize) * oldSize)
      const oldY = Math.floor((y / newSize) * oldSize)
      resized[y][x] = matrix[oldY]?.[oldX] ?? 0
    }
  }
  return resized
}

function buildPattern(kind, size) {
  const cells = []
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const cx = (x - size / 2) / size
      const cy = (y - size / 2) / size
      let value = 0

      if (kind === 'ring') {
        const radius = Math.sqrt(cx * cx + cy * cy)
        const ring = Math.exp(-((radius - 0.22) ** 2) / 0.008)
        const diagonal = Math.abs(y - x) < 2 ? 0.55 : 0
        const vertical = x > size * 0.64 && x < size * 0.8 ? 0.35 : 0
        const horizontal = y > size * 0.2 && y < size * 0.32 ? 0.3 : 0
        value = 0.08 + ring * 0.75 + diagonal + vertical + horizontal
      }

      if (kind === 'checker') {
        const block = (Math.floor(x / Math.max(2, size / 8))) + Math.floor(y / Math.max(2, size / 8))) % 2
        const centerGlow = Math.exp(-(cx * cx + cy * cy) / 0.18)
        value = 0.12 + block * 0.7 + centerGlow * 0.15
      }

      if (kind === 'bars') {
        const vertical = x % Math.max(3, Math.floor(size / 5)) < 2 ? 0.75 : 0.15
        const horizontal = y % Math.max(4, Math.floor(size / 4)) < 2 ? 0.5 : 0
        const slash = Math.abs(y - (size - x - 1)) < 2 ? 0.35 : 0
        value = 0.05 + vertical + horizontal + slash
      }

      if (kind === 'corners') {
        const topLeft = x < size * 0.35 && y < size * 0.35 && (x < 2 || y < 2) ? 0.9 : 0
        const topRight = x > size * 0.65 && y < size * 0.35 && (x > size - 3 || y < 2) ? 0.9 : 0
        const bottomLeft = x < size * 0.35 && y > size * 0.65 && (x < 2 || y > size - 3) ? 0.9 : 0
        const cornerBlob = Math.exp(-(((x - size * 0.7) **2 + (y - size * 0.7) ** 2) / Math.max(20, size * 1.1))) * 0.65
        value = 0.03 + topLeft + topRight + bottomLeft + cornerBlob
      }

      if (kind === 'blob') {
        const blobA = Math.exp(-(((x - size * 0.32) **2 + (y - size * 0.36) ** 2) / Math.max(18, size * 1.0)))
        const blobB = Math.exp(-(((x - size * 0.68) **2 + (y - size * 0.6) **2) / Math.max(18, size * 0.9))
        const bridge = Math.exp(-((x - size * 0.5) **2 + (y - size * 0.48) **2) / Math.max(40, size * 1.8))) * 0.45
        value = 0.04 + blobA * 0.75 + blobB * 0.9 + bridge
      }

      cells.push(clamp(value, 0, 1))
    }
  }
  return cells
}

function buildInitialKernels() {
  return [
    {
      id: 'sobelX',
      name: 'Vertical edge',
      description: 'Responds when intensity changes left-to-right.',
      matrix: [
        [-1, 0, 1],
        [-2, 0, 2],
        [-1, 0, 1],
      ],
    },
    {
      id: 'sobelY',
      name: 'Horizontal edge',
      description: 'Responds when intensity changes top-to-bottom.',
      matrix: [
        [-1, -2, -1],
        [0, 0, 0],
        [1, 2, 1],
      ],
    },
    {
      id: 'laplacian',
      name: 'Boundary',
      description: 'Highlights sharp local changes.',
      matrix: [
        [0, 1, 0],
        [1, -4, 1],
        [0, 1, 0],
      ],
    },
    {
      id: 'blur',
      name: 'Blur',
      description: 'Smooths local details.',
      matrix: [
        [1 / 9, 1 / 9, 1 / 9],
        [1 / 9, 1 / 9, 1 / 9],
        [1 / 9, 1 / 9, 1 / 9],
      ],
    },
  ]
}

function computeTrace(inputSize, layers) {
  let currentSize = inputSize
  let receptiveField = 1
  let jump = 1
  let start = 0.5

  return layers.map((layer, index) => {
    const effectiveKernel = layer.dilation * (layer.kernel - 1) + 1
    const rawOut = Math.floor((currentSize + 2 * layer.padding - effectiveKernel) / layer.stride) + 1
    const outSize = Math.max(1, rawOut)
    const nextReceptiveField = receptiveField + (effectiveKernel - 1) * jump
    const nextStart = start + (((effectiveKernel - 1) / 2) - layer.padding) * jump
    const nextJump = jump * layer.stride

    const result = {
      ...layer,
      index,
      effectiveKernel,
      inSize: currentSize,
      outSize,
      rf: nextReceptiveField,
      jump: nextJump,
      start: nextStart,
    }

    currentSize = outSize
    receptiveField = nextReceptiveField
    jump = nextJump
    start = nextStart

    return result
  })
}

function convolveMap(input, inputWidth, inputHeight, kernel, options = {}) {
  const stride = options.stride ?? 1
  const padding = options.padding ?? 0
  const dilation = options.dilation ?? 1
  const kernelHeight = kernel.length
  const kernelWidth = kernel[0].length
  const effectiveKernelWidth = dilation * (kernelWidth - 1) + 1
  const effectiveKernelHeight = dilation * (kernelHeight - 1) + 1
  const rawOutWidth = Math.floor((inputWidth + 2 * padding - effectiveKernelWidth) / stride) + 1
  const rawOutHeight = Math.floor((inputHeight + 2 * padding - effectiveKernelHeight) / stride) + 1
  const outWidth = Math.max(1, rawOutWidth)
  const outHeight = Math.max(1, rawOutHeight)
  const output = new Array(outWidth * outHeight).fill(0)

  for (let oy = 0; oy < outHeight; oy += 1) {
    for (let ox = 0; ox < outWidth; ox += 1) {
      let sum = 0
      for (let k