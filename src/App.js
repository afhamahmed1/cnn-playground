import './globals.css'
import './legacy-bridge.css'
import './responsive.css'
import React, { Suspense } from 'react'
import { RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function outerProduct(a, b) {
  return a.map((aValue) => b.map((bValue) => aValue * bValue))
}

function matTransposeVec(matrix, vector) {
  if (!matrix.length) return []
  return matrix[0].map((_, colIdx) => matrix.reduce((sum, row, rowIdx) => sum + (row[colIdx] ?? 0) * (vector[rowIdx] ?? 0), 0))
}

function addScaledMatrix(base, delta, scale) {
  return base.map((row, y) => row.map((value, x) => value + (delta[y]?.[x] ?? 0) * scale))
}

function addScaledVector(base, delta, scale) {
  return base.map((value, idx) => value + (delta[idx] ?? 0) * scale)
}

globalThis.outerProduct = globalThis.outerProduct ?? outerProduct
globalThis.matTransposeVec = globalThis.matTransposeVec ?? matTransposeVec
globalThis.addScaledMatrix = globalThis.addScaledMatrix ?? addScaledMatrix
globalThis.addScaledVector = globalThis.addScaledVector ?? addScaledVector

const LazyApp = React.lazy(() => import('./App.jsx'))

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6">
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>CNN Playground</CardTitle>
          <CardDescription>Loading the playground UI.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" size="sm" disabled>
            <RefreshCcw className="size-4 animate-spin" />
            Loading
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AppBridge() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <div className="min-h-screen bg-background text-foreground">
        <LazyApp />
      </div>
    </Suspense>
  )
}
