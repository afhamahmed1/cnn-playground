import { useEffect, useMemo, useState } from 'react'

const CLASS_INFO = [
  { id: 0, name: 'Edge', description: 'Looks for sharp boundary evidence.' },
  { id: 1, name: 'Texture', description: 'Looks for repeated local patterns.' },
  { id: 2, name: 'Blob', description: 'Looks for smoother regional structure.' },
]

const PATTERN_OPTIONS = [
  { id: 'ring', name: 'Ring' },
  { id: 'checker', name: 'Checkerboard' },
  { id: 'bars', name: 'Bars' },
  { id: 'blob', name: 'Blob' },
]

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
const flatten2D = (matrix) => matrix.flat()
const cloneMatrix = (matrix) => matrix.map((row) => [...row])
const dot = (a, b) => a.reduce((sum, value, idx) => sum + value * b[idx], 0)

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

function summarizeRange(data) {
  let min = Infinity
  let max = -Infinity
  let sum = 0
  let sumAbs = 0
  data.forEach((value) => {
    min = Math.min(min, value)
    max = Math.max(max, value)
    sum += value
    sumAbs += Math.abs(value)
  })
  return {
    min,
    max,
    mean: data.length ? sum / data.length : 0,
    meanAbs: data.length ? sumAbs / data.length : 0,
  }
}

function signedColor(value, min, max) {
  const bound = Math.max(Math.abs(min), Math.abs(max), 1e-6)
  const intensity = Math.min(Math.abs(value) / bound, 1)
  return value >= 0
    ? `rgba(14,165,233,${0.14 + intensity * 0.82})`
    : `rgba(225,29,72,${0.14 + intensity * 0.82})`
}

function grayColor(value, min, max) {
  const normalized = max - min < 1e-6 ? 0.5 : (value - min) / (max - min)
  const shade = Math.round((1 - normalized) * 220 + 10)
  return `rgb(${shade},${shade},${shade})`
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
        const diagonal = Math.abs(y - x) < 2 ? 0.5 : 0
        value = 0.05 + ring * 0.8 + diagonal
      }

      if (kind === 'checker') {
        const block = (Math.floor(x / Math.max(2, size / 8)) + Math.floor(y / Math.max(2, size / 8))) % 2
        value = 0.1 + block * 0.8
      }

      if (kind === 'bars') {
        const vertical = x % Math.max(3, Math.floor(size / 5)) < 2 ? 0.8 : 0.1
        const horizontal = y % Math.max(4, Math.floor(size / 4)) < 2 ? 0.4 : 0
        value = 0.05 + vertical + horizontal
      }

      if (kind === 'blob') {
        const a = Math.exp(-(((x - size * 0.3) ** 2 + (y - size * 0.4) ** 2) / Math.max(20, size * 1.2)))
        const b = Math.exp(-(((x - size * 0.68) ** 2 + (y - size * 0.62) ** 2) / Math.max(18, size)))
        value = 0.04 + a * 0.8 + b * 0.9
      }

      cells.push(clamp(value, 0, 1))
    }
  }
  return cells
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

function buildInitialKernels() {
  return [
    {
      id: 'sobelX',
      name: 'Vertical edge',
      description: 'Responds to left-right intensity change.',
      matrix: [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]],
    },
    {
      id: 'sobelY',
      name: 'Horizontal edge',
      description: 'Responds to top-bottom intensity change.',
      matrix: [[-1, -2, -1], [0, 0, 0], [1, 2, 1]],
    },
    {
      id: 'blur',
      name: 'Blur',
      description: 'Smooths local variation.',
      matrix: [[1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9]],
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
    const nextRf = receptiveField + (effectiveKernel - 1) * jump
    const nextStart = start + (((effectiveKernel - 1) / 2) - layer.padding) * jump
    const nextJump = jump * layer.stride
    const result = { ...layer, index, effectiveKernel, inSize: currentSize, outSize, rf: nextRf, jump: nextJump, start: nextStart }
    currentSize = outSize
    receptiveField = nextRf
    jump = nextJump
    start = nextStart
    return result
  })
}

function convolveMap(input, inputWidth, inputHeight, kernel, options = {}) {
  const stride = options.stride ?? 1
  const padding = options.padding ?? 0
  const dilation = options.dilation ?? 1
  const kh = kernel.length
  const kw = kernel[0].length
  const effW = dilation * (kw - 1) + 1
  const effH = dilation * (kh - 1) + 1
  const rawOutW = Math.floor((inputWidth + 2 * padding - effW) / stride) + 1
  const rawOutH = Math.floor((inputHeight + 2 * padding - effH) / stride) + 1
  const outWidth = Math.max(1, rawOutW)
  const outHeight = Math.max(1, rawOutH)
  const output = new Array(outWidth * outHeight).fill(0)

  for (let oy = 0; oy < outHeight; oy += 1) {
    for (let ox = 0; ox < outWidth; ox += 1) {
      let sum = 0
      for (let ky = 0; ky < kh; ky += 1) {
        for (let kx = 0; kx < kw; kx += 1) {
          const ix = ox * stride + kx * dilation - padding
          const iy = oy * stride + ky * dilation - padding
          const value = ix < 0 || iy < 0 || ix >= inputWidth || iy >= inputHeight ? 0 : input[iy * inputWidth + ix]
          sum += value * kernel[ky][kx]
        }
      }
      output[oy * outWidth + ox] = sum
    }
  }

  return { data: output, width: outWidth, height: outHeight }
}

function activateMap(data, mode) {
  if (mode === 'relu') return data.map((value) => Math.max(0, value))
  if (mode === 'sigmoid') return data.map((value) => 1 / (1 + Math.exp(-value)))
  if (mode === 'tanh') return data.map((value) => Math.tanh(value))
  return [...data]
}

function activationDerivative(data, mode) {
  if (mode === 'relu') return data.map((value) => (value > 0 ? 1 : 0))
  if (mode === 'sigmoid') return data.map((value) => {
    const s = 1 / (1 + Math.exp(-value))
    return s * (1 - s)
  })
  if (mode === 'tanh') return data.map((value) => {
    const t = Math.tanh(value)
    return 1 - t * t
  })
  return data.map(() => 1)
}

function poolMap(input, width, height, options = {}) {
  const kernel = options.kernel ?? 2
  const stride = options.stride ?? kernel
  const padding = options.padding ?? 0
  const mode = options.mode ?? 'max'
  const rawOutW = Math.floor((width + 2 * padding - kernel) / stride) + 1
  const rawOutH = Math.floor((height + 2 * padding - kernel) / stride) + 1
  const outWidth = Math.max(1, rawOutW)
  const outHeight = Math.max(1, rawOutH)
  const output = new Array(outWidth * outHeight).fill(0)

  for (let oy = 0; oy < outHeight; oy += 1) {
    for (let ox = 0; ox < outWidth; ox += 1) {
      const values = []
      for (let ky = 0; ky < kernel; ky += 1) {
        for (let kx = 0; kx < kernel; kx += 1) {
          const ix = ox * stride + kx - padding
          const iy = oy * stride + ky - padding
          values.push(ix < 0 || iy < 0 || ix >= width || iy >= height ? 0 : input[iy * width + ix])
        }
      }
      output[oy * outWidth + ox] = mode === 'avg'
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : values.reduce((best, value) => Math.max(best, value), -Infinity)
    }
  }

  return { data: output, width: outWidth, height: outHeight }
}

function backwardPooling(gradOut, input, width, height, options = {}) {
  const kernel = options.kernel ?? 2
  const stride = options.stride ?? kernel
  const padding = options.padding ?? 0
  const mode = options.mode ?? 'max'
  const rawOutW = Math.floor((width + 2 * padding - kernel) / stride) + 1
  const rawOutH = Math.floor((height + 2 * padding - kernel) / stride) + 1
  const outWidth = Math.max(1, rawOutW)
  const outHeight = Math.max(1, rawOutH)
  const gradIn = new Array(width * height).fill(0)

  for (let oy = 0; oy < outHeight; oy += 1) {
    for (let ox = 0; ox < outWidth; ox += 1) {
      const gradValue = gradOut[oy * outWidth + ox] ?? 0
      if (mode === 'avg') {
        const share = gradValue / (kernel * kernel)
        for (let ky = 0; ky < kernel; ky += 1) {
          for (let kx = 0; kx < kernel; kx += 1) {
            const ix = ox * stride + kx - padding
            const iy = oy * stride + ky - padding
            if (ix >= 0 && iy >= 0 && ix < width && iy < height) gradIn[iy * width + ix] += share
          }
        }
      } else {
        let bestIndex = null
        let bestValue = -Infinity
        for (let ky = 0; ky < kernel; ky += 1) {
          for (let kx = 0; kx < kernel; kx += 1) {
            const ix = ox * stride + kx - padding
            const iy = oy * stride + ky - padding
            const value = ix < 0 || iy < 0 || ix >= width || iy >= height ? 0 : input[iy * width + ix]
            if (value > bestValue) {
              bestValue = value
              bestIndex = ix >= 0 && iy >= 0 && ix < width && iy < height ? iy * width + ix : null
            }
          }
        }
        if (bestIndex !== null) gradIn[bestIndex] += gradValue
      }
    }
  }

  return { data: gradIn, width, height }
}

function backwardConvInput(gradOut, outWidth, outHeight, kernel, inputWidth, inputHeight, options = {}) {
  const stride = options.stride ?? 1
  const padding = options.padding ?? 0
  const dilation = options.dilation ?? 1
  const kh = kernel.length
  const kw = kernel[0].length
  const gradInput = new Array(inputWidth * inputHeight).fill(0)

  for (let oy = 0; oy < outHeight; oy += 1) {
    for (let ox = 0; ox < outWidth; ox += 1) {
      const gradValue = gradOut[oy * outWidth + ox] ?? 0
      for (let ky = 0; ky < kh; ky += 1) {
        for (let kx = 0; kx < kw; kx += 1) {
          const ix = ox * stride + kx * dilation - padding
          const iy = oy * stride + ky * dilation - padding
          if (ix >= 0 && iy >= 0 && ix < inputWidth && iy < inputHeight) gradInput[iy * inputWidth + ix] += gradValue * kernel[ky][kx]
        }
      }
    }
  }

  return { data: gradInput, width: inputWidth, height: inputHeight }
}

function backwardConvKernel(gradOut, outWidth, outHeight, input, inputWidth, inputHeight, kh, kw, options = {}) {
  const stride = options.stride ?? 1
  const padding = options.padding ?? 0
  const dilation = options.dilation ?? 1
  const gradKernel = Array.from({ length: kh }, () => Array.from({ length: kw }, () => 0))

  for (let oy = 0; oy < outHeight; oy += 1) {
    for (let ox = 0; ox < outWidth; ox += 1) {
      const gradValue = gradOut[oy * outWidth + ox] ?? 0
      for (let ky = 0; ky < kh; ky += 1) {
        for (let kx = 0; kx < kw; kx += 1) {
          const ix = ox * stride + kx * dilation - padding
          const iy = oy * stride + ky * dilation - padding
          const value = ix < 0 || iy < 0 || ix >= inputWidth || iy >= inputHeight ? 0 : input[iy * inputWidth + ix]
          gradKernel[ky][kx] += gradValue * value
        }
      }
    }
  }

  return gradKernel
}

function buildDenseParameters(inputDim, hiddenDim = 6, numClasses = CLASS_INFO.length) {
  const w1 = Array.from({ length: hiddenDim }, (_, h) => Array.from({ length: inputDim }, (_, i) => 0.12 * Math.sin((h + 1) * (i + 1) * 0.31)))
  const b1 = Array.from({ length: hiddenDim }, (_, i) => (i - (hiddenDim - 1) / 2) * 0.04)
  const w2 = Array.from({ length: numClasses }, (_, c) => Array.from({ length: hiddenDim }, (_, h) => 0.2 * Math.cos((c + 1) * (h + 1) * 0.47)))
  const b2 = Array.from({ length: numClasses }, (_, i) => (i - (numClasses - 1) / 2) * 0.03)
  return { inputDim, hiddenDim, w1, b1, w2, b2 }
}

function softmax(values) {
  const maxValue = Math.max(...values)
  const exps = values.map((value) => Math.exp(value - maxValue))
  const sum = exps.reduce((acc, value) => acc + value, 0) || 1
  return exps.map((value) => value / sum)
}

function crossEntropy(probabilities, targetIndex) {
  return -Math.log(Math.max(probabilities[targetIndex] ?? 1e-9, 1e-9))
}

function analyzeModel(inputData, inputSize, kernel, denseParams, settings, targetClass) {
  const conv = convolveMap(inputData, inputSize, inputSize, kernel, settings.conv)
  const activated = { ...conv, data: activateMap(conv.data, settings.activation) }
  const pooled = poolMap(activated.data, activated.width, activated.height, settings.pool)
  const flat = pooled.data
  const hiddenPre = denseParams.w1.map((row, idx) => dot(row, flat) + denseParams.b1[idx])
  const hiddenAct = hiddenPre.map((value) => Math.max(0, value))
  const logits = denseParams.w2.map((row, idx) => dot(row, hiddenAct) + denseParams.b2[idx])
  const probabilities = softmax(logits)
  const loss = crossEntropy(probabilities, targetClass)

  const dLogits = probabilities.map((value, idx) => value - (idx === targetClass ? 1 : 0))
  const dW2 = outerProduct(dLogits, hiddenAct)
  const db2 = dLogits
  const dHiddenAct = matTransposeVec(denseParams.w2, dLogits)
  const dHiddenPre = dHiddenAct.map((value, idx) => value * (hiddenPre[idx] > 0 ? 1 : 0))
  const dW1 = outerProduct(dHiddenPre, flat)
  const db1 = dHiddenPre
  const dFlat = matTransposeVec(denseParams.w1, dHiddenPre)
  const gradPooled = { data: dFlat, width: pooled.width, height: pooled.height }
  const gradAfterPool = backwardPooling(gradPooled.data, activated.data, activated.width, activated.height, settings.pool)
  const actDer = activationDerivative(conv.data, settings.activation)
  const gradPreActivation = {
    data: gradAfterPool.data.map((value, idx) => value * actDer[idx]),
    width: gradAfterPool.width,
    height: gradAfterPool.height,
  }
  const gradInput = backwardConvInput(gradPreActivation.data, gradPreActivation.width, gradPreActivation.height, kernel, inputSize, inputSize, settings.conv)
  const gradKernel = backwardConvKernel(gradPreActivation.data, gradPreActivation.width, gradPreActivation.height, inputData, inputSize, inputSize, kernel.length, kernel[0].length, settings.conv)

  return {
    conv,
    activated,
    pooled,
    flat,
    hiddenAct,
    logits,
    probabilities,
    loss,
    grads: { dLogits, dW1, db1, dW2, db2, dHiddenPre, gradPooled, gradAfterPool, actDer, gradPreActivation, gradInput, gradKernel },
  }
}

function computeOverlay(inputSize, layer, cell) {
  if (!layer) return null
  const centerX = layer.start + cell.x * layer.jump
  const centerY = layer.start + cell.y * layer.jump
  const half = (layer.rf - 1) / 2
  return {
    left: ((Math.max(0, centerX - half - 0.5)) / inputSize) * 100,
    top: ((Math.max(0, centerY - half - 0.5)) / inputSize) * 100,
    width: ((Math.min(inputSize, centerX + half + 0.5) - Math.max(0, centerX - half - 0.5)) / inputSize) * 100,
    height: ((Math.min(inputSize, centerY + half + 0.5) - Math.max(0, centerY - half - 0.5)) / inputSize) * 100,
  }
}

function Heatmap({ data, width, height, mode = 'grayscale', selectedCell, onCellClick, onMouseDown, onMouseEnter, overlay, maxWidth }) {
  const summary = useMemo(() => summarizeRange(data), [data])
  return (
    <div className={`heatmap${maxWidth ? ' mini-heatmap' : ''}`} style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`, maxWidth: maxWidth || undefined }}>
      {overlay ? <div className="overlay-box" style={overlay} /> : null}
      {data.map((value, idx) => {
        const x = idx % width
        const y = Math.floor(idx / width)
        const selected = selectedCell && selectedCell.x === x && selectedCell.y === y
        return (
          <button
            key={`${x}-${y}`}
            type="button"
            className={`heatmap-cell${selected ? ' selected' : ''}`}
            style={{ background: mode === 'signed' ? signedColor(value, summary.min, summary.max) : grayColor(value, summary.min, summary.max) }}
            title={`(${x}, ${y}) = ${value.toFixed(3)}`}
            onClick={onCellClick ? () => onCellClick({ x, y }) : undefined}
            onMouseDown={onMouseDown ? (event) => { event.preventDefault(); onMouseDown(x, y) } : undefined}
            onMouseEnter={onMouseEnter ? () => onMouseEnter(x, y) : undefined}
          />
        )
      })}
    </div>
  )
}

function StatCard({ label, value, help }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-help">{help}</div>
    </div>
  )
}

function BarList({ values, labels, mode = 'signed' }) {
  const scale = mode === 'signed' ? (maxAbs(values) || 1) : Math.max(...values, 1e-6)
  return (
    <div className="bars">
      {values.map((value, idx) => {
        const magnitude = Math.abs(value) / scale
        const fillClass = mode === 'signed' ? (value >= 0 ? 'pos' : 'neg') : 'neutral'
        return (
          <div className="bar-row" key={`${labels[idx]}-${idx}`}>
            <div className="bar-label">{labels[idx]}</div>
            <div className="bar-track"><div className={`bar-fill ${fillClass}`} style={{ width: `${Math.max(4, magnitude * 100)}%` }} /></div>
            <div className="bar-number">{value.toFixed(3)}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function App() {
  const [inputSize, setInputSize] = useState(25)
  const [pattern, setPattern] = useState('ring')
  const [inputData, setInputData] = useState(() => buildPattern('ring', 25))
  const [brushMode, setBrushMode] = useState('draw')
  const [brushValue, setBrushValue] = useState(1)
  const [brushSize, setBrushSize] = useState(1)
  const [painting, setPainting] = useState(false)
  const [activation, setActivation] = useState('relu')
  const [poolMode, setPoolMode] = useState('max')
  const [targetClass, setTargetClass] = useState(0)
  const [learningRate, setLearningRate] = useState(0.01)
  const [iterations, setIterations] = useState(5)
  const [backpropView, setBackpropView] = useState('beginner')
  const [layers, setLayers] = useState([
    { id: 1, type: 'conv', kernel: 3, stride: 1, padding: 1, dilation: 1 },
    { id: 2, type: 'conv', kernel: 3, stride: 1, padding: 1, dilation: 1 },
    { id: 3, type: 'pool', kernel: 2, stride: 2, padding: 0, dilation: 1 },
    { id: 4, type: 'conv', kernel: 3, stride: 1, padding: 1, dilation: 2 },
  ])
  const [nextLayerId, setNextLayerId] = useState(5)
  const [inspectedLayerIndex, setInspectedLayerIndex] = useState(3)
  const [rfCell, setRfCell] = useState({ x: 0, y: 0 })
  const [kernels, setKernels] = useState(buildInitialKernels)
  const [activeKernelId, setActiveKernelId] = useState('sobelX')
  const [nextKernelId, setNextKernelId] = useState(1)
  const [denseParams, setDenseParams] = useState(null)
  const [lastRun, setLastRun] = useState({ steps: 0, startLoss: null, endLoss: null })
  const [totalSteps, setTotalSteps] = useState(0)

  useEffect(() => {
    const stop = () => setPainting(false)
    window.addEventListener('mouseup', stop)
    return () => window.removeEventListener('mouseup', stop)
  }, [])

  const trace = useMemo(() => computeTrace(inputSize, layers), [inputSize, layers])
  const selectedLayer = trace[Math.min(inspectedLayerIndex, Math.max(0, trace.length - 1))] || null
  const featureSize = selectedLayer?.outSize || 1
  const activeKernel = useMemo(() => kernels.find((kernel) => kernel.id === activeKernelId) || kernels[0], [kernels, activeKernelId])

  useEffect(() => {
    setRfCell((current) => ({ x: clamp(current.x, 0, featureSize - 1), y: clamp(current.y, 0, featureSize - 1) }))
  }, [featureSize])

  const primaryConvLayer = useMemo(() => layers.find((layer) => layer.type === 'conv') || null, [layers])
  const primaryPoolLayer = useMemo(() => layers.find((layer) => layer.type === 'pool') || null, [layers])

  const convConfig = useMemo(() => primaryConvLayer
    ? { stride: primaryConvLayer.stride, padding: primaryConvLayer.padding, dilation: primaryConvLayer.dilation }
    : { stride: 1, padding: Math.floor(activeKernel.matrix.length / 2), dilation: 1 }, [primaryConvLayer, activeKernel])

  const poolConfig = useMemo(() => primaryPoolLayer
    ? { kernel: primaryPoolLayer.kernel, stride: primaryPoolLayer.stride, padding: primaryPoolLayer.padding, mode: poolMode }
    : { kernel: 2, stride: 2, padding: 0, mode: poolMode }, [primaryPoolLayer, poolMode])

  const previewForDim = useMemo(() => {
    const conv = convolveMap(inputData, inputSize, inputSize, activeKernel.matrix, convConfig)
    const act = activateMap(conv.data, activation)
    return poolMap(act, conv.width, conv.height, poolConfig)
  }, [inputData, inputSize, activeKernel, convConfig, activation, poolConfig])

  useEffect(() => {
    if (!denseParams || denseParams.inputDim !== previewForDim.data.length) {
      setDenseParams(buildDenseParameters(previewForDim.data.length, 6))
    }
  }, [previewForDim.data.length])

  const effectiveDense = denseParams || buildDenseParameters(previewForDim.data.length, 6)

  const analysis = useMemo(() => analyzeModel(inputData, inputSize, activeKernel.matrix, effectiveDense, { conv: convConfig, pool: poolConfig, activation }, targetClass), [inputData, inputSize, activeKernel, effectiveDense, convConfig, poolConfig, activation, targetClass])

  const forwardStats = useMemo(() => summarizeRange(analysis.activated.data), [analysis])
  const pooledStats = useMemo(() => summarizeRange(analysis.pooled.data), [analysis])
  const inputGradStats = useMemo(() => summarizeRange(analysis.grads.gradInput.data), [analysis])
  const kernelGradStats = useMemo(() => summarizeRange(flatten2D(analysis.grads.gradKernel)), [analysis])
  const topClass = CLASS_INFO[analysis.probabilities.indexOf(Math.max(...analysis.probabilities))]
  const overlay = useMemo(() => computeOverlay(inputSize, selectedLayer, rfCell), [inputSize, selectedLayer, rfCell])

  const paintCell = (x, y) => {
    const radius = Math.max(0, Math.floor(brushSize / 2))
    setInputData((current) => {
      const next = [...current]
      for (let py = y - radius; py <= y + radius; py += 1) {
        for (let px = x - radius; px <= x + radius; px += 1) {
          if (px < 0 || py < 0 || px >= inputSize || py >= inputSize) continue
          next[py * inputSize + px] = brushMode === 'erase' ? 0 : brushValue
        }
      }
      return next
    })
  }

  const handleResizeInput = (nextSize) => {
    const size = clamp(Math.round(nextSize), 12, 40)
    setInputData((current) => resizeGrid(current, inputSize, size))
    setInputSize(size)
  }

  const runTrainingSteps = (steps) => {
    const safeSteps = clamp(Math.round(steps), 1, 100)
    let kernel = cloneMatrix(activeKernel.matrix)
    let params = {
      inputDim: effectiveDense.inputDim,
      hiddenDim: effectiveDense.hiddenDim,
      w1: cloneMatrix(effectiveDense.w1),
      b1: [...effectiveDense.b1],
      w2: cloneMatrix(effectiveDense.w2),
      b2: [...effectiveDense.b2],
    }
    const settings = { conv: convConfig, pool: poolConfig, activation }
    const startLoss = analyzeModel(inputData, inputSize, kernel, params, settings, targetClass).loss

    for (let step = 0; step < safeSteps; step += 1) {
      const result = analyzeModel(inputData, inputSize, kernel, params, settings, targetClass)
      kernel = addScaledMatrix(kernel, result.grads.gradKernel, -learningRate)
      params = {
        ...params,
        w1: addScaledMatrix(params.w1, result.grads.dW1, -learningRate),
        b1: addScaledVector(params.b1, result.grads.db1, -learningRate),
        w2: addScaledMatrix(params.w2, result.grads.dW2, -learningRate),
        b2: addScaledVector(params.b2, result.grads.db2, -learningRate),
      }
    }

    const endLoss = analyzeModel(inputData, inputSize, kernel, params, settings, targetClass).loss
    setKernels((current) => current.map((item) => (item.id === activeKernelId ? { ...item, matrix: kernel } : item)))
    setDenseParams(params)
    setLastRun({ steps: safeSteps, startLoss, endLoss })
    setTotalSteps((value) => value + safeSteps)
  }

  return (
    <div className="app-shell">
      <section className="card hero-card">
        <div className="pill">React CNN Playground</div>
        <h1>CNN Playground</h1>
        <p className="muted">Draw the input, resize it, edit kernels, inspect receptive fields, and train a tiny classifier with softmax and cross-entropy.</p>
      </section>

      <section className="card">
        <div className="section-head"><div><h2>Input studio</h2><p className="muted">Use presets or draw directly on the input grid.</p></div><div className="button-wrap"><button onClick={() => setInputData(new Array(inputSize * inputSize).fill(0))}>Clear</button><button onClick={() => setInputData(buildPattern(pattern, inputSize))}>Reload preset</button></div></div>
        <div className="grid-two">
          <div className="stack">
            <div className="button-wrap">{PATTERN_OPTIONS.map((option) => <button key={option.id} className={pattern === option.id ? 'active' : ''} onClick={() => { setPattern(option.id); setInputData(buildPattern(option.id, inputSize)) }}>{option.name}</button>)}</div>
            <div className="button-wrap"><button className={brushMode === 'draw' ? 'active' : ''} onClick={() => setBrushMode('draw')}>Draw</button><button className={brushMode === 'erase' ? 'active' : ''} onClick={() => setBrushMode('erase')}>Erase</button></div>
            <div className="control"><label>Input resolution</label><div className="control-row"><input type="range" min="12" max="40" step="1" value={inputSize} onChange={(e) => handleResizeInput(Number(e.target.value))} /><input type="number" min="12" max="40" step="1" value={inputSize} onChange={(e) => handleResizeInput(Number(e.target.value))} /></div></div>
            <div className="control"><label>Brush size</label><div className="control-row"><input type="range" min="1" max="7" step="1" value={brushSize} onChange={(e) => setBrushSize(clamp(Number(e.target.value), 1, 7))} /><input type="number" min="1" max="7" step="1" value={brushSize} onChange={(e) => setBrushSize(clamp(Number(e.target.value), 1, 7))} /></div></div>
            <div className="control"><label>Brush value</label><div className="control-row"><input type="range" min="0" max="1" step="0.05" value={brushValue} onChange={(e) => setBrushValue(clamp(Number(e.target.value), 0, 1))} /><input type="number" min="0" max="1" step="0.05" value={brushValue} onChange={(e) => setBrushValue(clamp(Number(e.target.value), 0, 1))} /></div></div>
          </div>
          <div><h3>Editable input</h3><Heatmap data={inputData} width={inputSize} height={inputSize} mode="grayscale" onMouseDown={(x, y) => { setPainting(true); paintCell(x, y) }} onMouseEnter={(x, y) => { if (painting) paintCell(x, y) }} /></div>
        </div>
      </section>

      <section className="card">
        <div className="section-head"><div><h2>Receptive field explorer</h2><p className="muted">Click a layer card to inspect how much of the input one neuron can see.</p></div></div>
        <div className="grid-two">
          <div><h3>Input with overlay</h3><Heatmap data={inputData} width={inputSize} height={inputSize} mode="grayscale" overlay={overlay} /></div>
          <div><h3>Selected stage map</h3><Heatmap data={new Array(featureSize * featureSize).fill(0).map((_, idx) => idx)} width={featureSize} height={featureSize} mode="grayscale" selectedCell={rfCell} onCellClick={setRfCell} /><div className="stat-grid four"><StatCard label="RF size" value={`${selectedLayer?.rf ?? 1}×${selectedLayer?.rf ?? 1}`} help="Theoretical input area." /><StatCard label="Jump" value={selectedLayer?.jump ?? 1} help="Spacing in input pixels." /><StatCard label="Eff. kernel" value={selectedLayer?.effectiveKernel ?? 1} help="Kernel footprint after dilation." /><StatCard label="Output size" value={`${selectedLayer?.outSize ?? inputSize}×${selectedLayer?.outSize ?? inputSize}`} help="Spatial size at this stage." /></div></div>
        </div>
        <div className="top-gap stack">{trace.map((layer, idx) => <button key={layer.id} className={`list-card ${idx === inspectedLayerIndex ? 'active' : ''}`} onClick={() => { setInspectedLayerIndex(idx); const c = Math.floor(layer.outSize / 2); setRfCell({ x: c, y: c }) }}><div className="list-card-top"><div><div className="list-title">Layer {idx + 1}: {layer.type === 'conv' ? 'Convolution' : 'Pooling'}</div><div className="mini">in {layer.inSize} → out {layer.outSize} · kernel {layer.kernel} · stride {layer.stride} · pad {layer.padding} · dilation {layer.dilation}</div></div><div className="rf-pill">{layer.rf}</div></div></button>)}</div>
      </section>

      <section className="card">
        <div className="section-head"><div><h2>Kernel studio</h2><p className="muted">Edit a kernel, duplicate it, resize it, or add a new one.</p></div><div className="button-wrap"><button onClick={() => { const id = `custom-${nextKernelId}`; setKernels((current) => [...current, { id, name: `Custom ${nextKernelId}`, description: 'User-created kernel.', matrix: [[0, 0, 0], [0, 1, 0], [0, 0, 0]] }]); setNextKernelId((value) => value + 1); setActiveKernelId(id) }}>Add kernel</button><button onClick={() => { const id = `custom-${nextKernelId}`; setKernels((current) => [...current, { id, name: `${activeKernel.name} copy`, description: activeKernel.description, matrix: cloneMatrix(activeKernel.matrix) }]); setNextKernelId((value) => value + 1); setActiveKernelId(id) }}>Duplicate</button><button onClick={() => { if (kernels.length <= 1) return; const remaining = kernels.filter((kernel) => kernel.id !== activeKernelId); setKernels(remaining); setActiveKernelId(remaining[0].id) }}>Delete</button></div></div>
        <div className="grid-two">
          <div className="stack">{kernels.map((kernel) => <button key={kernel.id} className={`list-card ${kernel.id === activeKernelId ? 'active' : ''}`} onClick={() => setActiveKernelId(kernel.id)}><div className="list-title">{kernel.name}</div><div className="mini">{kernel.description}</div><div className="mini-map"><Heatmap data={flatten2D(kernel.matrix)} width={kernel.matrix.length} height={kernel.matrix.length} mode="signed" maxWidth={180} /></div></button>)}</div>
          <div className="stack"><div className="control"><label>Kernel name</label><input value={activeKernel.name} onChange={(e) => setKernels((current) => current.map((kernel) => kernel.id === activeKernelId ? { ...kernel, name: e.target.value } : kernel))} /></div><div className="control"><label>Description</label><input value={activeKernel.description} onChange={(e) => setKernels((current) => current.map((kernel) => kernel.id === activeKernelId ? { ...kernel, description: e.target.value } : kernel))} /></div><div className="control"><label>Kernel size</label><div className="control-row"><input type="range" min="1" max="7" step="1" value={activeKernel.matrix.length} onChange={(e) => setKernels((current) => current.map((kernel) => kernel.id === activeKernelId ? { ...kernel, matrix: resizeKernelMatrix(kernel.matrix, clamp(Number(e.target.value), 1, 7)) } : kernel))} /><input type="number" min="1" max="7" step="1" value={activeKernel.matrix.length} onChange={(e) => setKernels((current) => current.map((kernel) => kernel.id === activeKernelId ? { ...kernel, matrix: resizeKernelMatrix(kernel.matrix, clamp(Number(e.target.value), 1, 7)) } : kernel))} /></div></div><div className="editor-grid">{activeKernel.matrix.map((row, y) => row.map((value, x) => <input key={`${y}-${x}`} type="number" step="0.25" value={value} onChange={(e) => setKernels((current) => current.map((kernel) => { if (kernel.id !== activeKernelId) return kernel; const matrix = cloneMatrix(kernel.matrix); matrix[y][x] = Number(e.target.value); return { ...kernel, matrix } }))} />))}</div></div>
        </div>
      </section>

      <section className="card">
        <div className="section-head"><div><h2>Forward feature maps</h2><p className="muted">See the selected kernel flow through convolution, activation, and pooling.</p></div><div className="button-wrap"><select value={activation} onChange={(e) => setActivation(e.target.value)}><option value="relu">Activation: ReLU</option><option value="none">Activation: none</option><option value="tanh">Activation: tanh</option><option value="sigmoid">Activation: sigmoid</option></select><select value={poolMode} onChange={(e) => setPoolMode(e.target.value)}><option value="max">Pooling: max</option><option value="avg">Pooling: average</option></select></div></div>
        <div className="grid-two compact"><div><h3>Input</h3><Heatmap data={inputData} width={inputSize} height={inputSize} mode="grayscale" /></div><div><h3>Raw convolution</h3><Heatmap data={analysis.conv.data} width={analysis.conv.width} height={analysis.conv.height} mode="signed" /></div><div><h3>After activation</h3><Heatmap data={analysis.activated.data} width={analysis.activated.width} height={analysis.activated.height} mode="signed" /></div><div><h3>After pooling</h3><Heatmap data={analysis.pooled.data} width={analysis.pooled.width} height={analysis.pooled.height} mode="signed" /></div></div>
        <div className="stat-grid four"><StatCard label="Activated range" value={`${forwardStats.min.toFixed(2)}→${forwardStats.max.toFixed(2)}`} help="Spread after nonlinearity." /><StatCard label="Mean" value={forwardStats.mean.toFixed(2)} help="Average feature strength." /><StatCard label="Mean |x|" value={forwardStats.meanAbs.toFixed(2)} help="Overall activation energy." /><StatCard label="Pool range" value={`${pooledStats.min.toFixed(2)}→${pooledStats.max.toFixed(2)}`} help="How downsampling compresses the signal." /></div>
      </section>

      <section className="card">
        <div className="section-head"><div><h2>FFN head, softmax, and cross-entropy</h2><p className="muted">Flattened pooled features feed a small hidden layer, then logits, then softmax probabilities, then loss.</p></div><div className="button-wrap">{CLASS_INFO.map((item) => <button key={item.id} className={targetClass === item.id ? 'active' : ''} onClick={() => setTargetClass(item.id)}>Target: {item.name}</button>)}</div></div>
        <div className="grid-two"><div className="stack"><div><h3>Pooled features</h3><Heatmap data={analysis.pooled.data} width={analysis.pooled.width} height={analysis.pooled.height} mode="signed" /></div><div><h3>Hidden activations</h3><BarList values={analysis.hiddenAct} labels={analysis.hiddenAct.map((_, idx) => `H${idx + 1}`)} mode="unsigned" /></div></div><div className="stack"><div><h3>Logits</h3><BarList values={analysis.logits} labels={CLASS_INFO.map((item) => item.name)} mode="signed" /></div><div><h3>Softmax probabilities</h3><BarList values={analysis.probabilities} labels={CLASS_INFO.map((item) => item.name)} mode="unsigned" /></div></div></div>
        <div className="stat-grid four"><StatCard label="Target prob." value={(analysis.probabilities[targetClass] ?? 0).toFixed(3)} help="Current target-class probability." /><StatCard label="Cross-entropy" value={analysis.loss.toFixed(3)} help="Lower means the model is more confident in the target class." /><StatCard label="Top class" value={topClass?.name ?? '—'} help="Highest softmax probability." /><StatCard label="Feature dim" value={analysis.flat.length} help="Flattened pooled feature count." /></div>
      </section>

      <section className="card">
        <div className="section-head"><div><h2>Backpropagation and training</h2><p className="muted">Run one step or many steps from cross-entropy loss back through the dense head, pooling, activation, and convolution.</p></div><div className="button-wrap"><div className="control"><label>Learning rate</label><div className="control-row"><input type="range" min="0.001" max="0.1" step="0.001" value={learningRate} onChange={(e) => setLearningRate(clamp(Number(e.target.value), 0.001, 0.1))} /><input type="number" min="0.001" max="0.1" step="0.001" value={learningRate} onChange={(e) => setLearningRate(clamp(Number(e.target.value), 0.001, 0.1))} /></div></div><div className="control"><label>Iterations</label><div className="control-row"><input type="range" min="1" max="100" step="1" value={iterations} onChange={(e) => setIterations(clamp(Number(e.target.value), 1, 100))} /><input type="number" min="1" max="100" step="1" value={iterations} onChange={(e) => setIterations(clamp(Number(e.target.value), 1, 100))} /></div></div><button className="primary" onClick={() => runTrainingSteps(1)}>Run 1 step</button><button onClick={() => runTrainingSteps(iterations)}>Run {iterations} steps</button><button onClick={() => { setDenseParams(buildDenseParameters(analysis.flat.length, 6)); setLastRun({ steps: 0, startLoss: null, endLoss: null }); setTotalSteps(0) }}>Reset head</button></div></div>
        <div className="stat-grid four"><StatCard label="Total train steps" value={totalSteps} help="Total visible training iterations." /><StatCard label="Last run steps" value={lastRun.steps || 0} help="Steps in most recent run." /><StatCard label="Loss before" value={lastRun.startLoss == null ? '—' : lastRun.startLoss.toFixed(3)} help="Cross-entropy before the run." /><StatCard label="Loss after" value={lastRun.endLoss == null ? '—' : lastRun.endLoss.toFixed(3)} help="Cross-entropy after the run." /></div>
        <div className="button-wrap top-gap"><button className={backpropView === 'beginner' ? 'active' : ''} onClick={() => setBackpropView('beginner')}>Beginner view</button><button className={backpropView === 'technical' ? 'active' : ''} onClick={() => setBackpropView('technical')}>Technical view</button></div>
        {backpropView === 'beginner' ? <div className="grid-three top-gap"><div className="panel"><h3>Hidden units that receive feedback</h3><BarList values={analysis.grads.dHiddenPre.map((value) => Math.abs(value))} labels={analysis.hiddenAct.map((_, idx) => `H${idx + 1}`)} mode="unsigned" /></div><div className="panel"><h3>Pooled features that matter most</h3><Heatmap data={normalizeArray(analysis.grads.gradPooled.data.map((value) => Math.abs(value)))} width={analysis.grads.gradPooled.width} height={analysis.grads.gradPooled.height} mode="grayscale" /></div><div className="panel"><h3>Input pixels that matter most</h3><Heatmap data={normalizeArray(analysis.grads.gradInput.data.map((value) => Math.abs(value)))} width={analysis.grads.gradInput.width} height={analysis.grads.gradInput.height} mode="grayscale" /></div></div> : <div className="grid-two top-gap"><div className="panel"><h3>dL / d logits</h3><BarList values={analysis.grads.dLogits} labels={CLASS_INFO.map((item) => item.name)} mode="signed" /></div><div className="panel"><h3>dL / d input</h3><Heatmap data={normalizeArray(analysis.grads.gradInput.data)} width={analysis.grads.gradInput.width} height={analysis.grads.gradInput.height} mode="signed" /></div></div>}
        <div className="stat-grid four"><StatCard label="Input grad range" value={`${inputGradStats.min.toFixed(2)}→${inputGradStats.max.toFixed(2)}`} help="Signed sensitivity of the loss to input pixels." /><StatCard label="Mean |input grad|" value={inputGradStats.meanAbs.toFixed(2)} help="How strongly the loss depends on the image." /><StatCard label="Kernel grad range" value={`${kernelGradStats.min.toFixed(2)}→${kernelGradStats.max.toFixed(2)}`} help="Which kernel weights matter most." /><StatCard label="Current loss" value={analysis.loss.toFixed(3)} help="Cross-entropy for the current model state." /></div>
      </section>

      <section className="card">
        <div className="section-head"><div><h2>Architecture controls</h2><p className="muted">Adjust the stages used by the visualizations and classifier pipeline.</p></div><div className="button-wrap"><button onClick={() => { setLayers((current) => [...current, { id: nextLayerId, type: 'conv', kernel: 3, stride: 1, padding: 1, dilation: 1 }]); setNextLayerId((value) => value + 1) }}>Add conv layer</button><button onClick={() => { setLayers((current) => [...current, { id: nextLayerId, type: 'pool', kernel: 2, stride: 2, padding: 0, dilation: 1 }]); setNextLayerId((value) => value + 1) }}>Add pooling layer</button></div></div>
        <div className="stack">{layers.map((layer, idx) => <div className="list-card" key={layer.id}><div className="list-card-top"><div><div className="list-title">Layer {idx + 1}</div><div className="mini">{layer.type === 'conv' ? 'Convolution' : 'Pooling'}</div></div><button onClick={() => setLayers((current) => current.filter((item) => item.id !== layer.id))}>Remove</button></div><div className="editor-grid top-gap"><input type="number" value={layer.kernel} min="1" max="7" step="1" onChange={(e) => setLayers((current) => current.map((item) => item.id === layer.id ? { ...item, kernel: clamp(Number(e.target.value), 1, 7) } : item))} /><input type="number" value={layer.stride} min="1" max="4" step="1" onChange={(e) => setLayers((current) => current.map((item) => item.id === layer.id ? { ...item, stride: clamp(Number(e.target.value), 1, 4) } : item))} /><input type="number" value={layer.padding} min="0" max="4" step="1" onChange={(e) => setLayers((current) => current.map((item) => item.id === layer.id ? { ...item, padding: clamp(Number(e.target.value), 0, 4) } : item))} /><input type="number" value={layer.dilation} min="1" max="4" step="1" onChange={(e) => setLayers((current) => current.map((item) => item.id === layer.id ? { ...item, dilation: clamp(Number(e.target.value), 1, 4) } : item))} /><select value={layer.type} onChange={(e) => setLayers((current) => current.map((item) => item.id === layer.id ? { ...item, type: e.target.value } : item))}><option value="conv">Convolution</option><option value="pool">Pooling</option></select></div></div>)}</div>
      </section>
    </div>
  )
}
