import './responsive.css'
import React, { Suspense } from 'react'

function outerProduct(a, b) {
  return a.map((aValue) => b.map((bValue) => aValue * bValue))
}

function matTransposeVec(matrix, vector) {
  if (!matrix.length) return []
  return matrix[0].map((_, colIdx) => (
    matrix.reduce((sum, row, rowIdx) => sum + (row[colIdx] ?? 0) * (vector[rowIdx] ?? 0), 0)
  ))
}

function addScaledMatrix(base, delta, scale) {
  return base.map((row, y) => (
    row.map((value, x) => value + (delta[y]?.[x] ?? 0) * scale)
  ))
}

function addScaledVector(base, delta, scale) {
  return base.map((value, idx) => value + (delta[idx] ?? 0) * scale)
}

globalThis.outerProduct = globalThis.outerProduct ?? outerProduct
globalThis.matTransposeVec = globalThis.matTransposeVec ?? matTransposeVec
globalThis.addScaledMatrix = globalThis.addScaledMatrix ?? addScaledMatrix
globalThis.addScaledVector = globalThis.addScaledVector ?? addScaledVector

const LazyApp = React.lazy(() => import('./App.jsx'))

export default function AppBridge() {
  return React.createElement(
    Suspense,
    { fallback: null },
    React.createElement(LazyApp),
  )
}
