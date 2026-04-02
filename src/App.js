import './globals.css'
import './legacy-bridge.css'
import './responsive.css'
import React, { Suspense } from 'react'
import { ArrowUpRight, RefreshCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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

function ShellIntro() {
  return (
    <Card className="border-dashed bg-muted/30 shadow-none">
      <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Badge variant="secondary">shadcn ui migration</Badge>
          <div className="space-y-1">
            <CardTitle className="text-xl">CNN Playground</CardTitle>
            <CardDescription>
              The app now has a shadcn and Tailwind foundation, bridged tokens for the legacy markup, and a gradual component migration path.
            </CardDescription>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            Back to top
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <a href="https://github.com/afhamahmed1/cnn-playground" target="_blank" rel="noreferrer">
              View repo
              <ArrowUpRight className="size-4" />
            </a>
          </Button>
        </div>
      </CardHeader>
    </Card>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <ShellIntro />
        <Card className="mx-auto w-full max-w-xl">
          <CardHeader>
            <CardTitle>Loading the playground</CardTitle>
            <CardDescription>The interactive CNN workspace is being prepared.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" size="sm" disabled>
              <RefreshCcw className="size-4 animate-spin" />
              Loading
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function AppBridge() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <div className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <ShellIntro />
          <div className="min-h-screen bg-background text-foreground">
            <LazyApp />
          </div>
        </div>
      </div>
    </Suspense>
  )
}
