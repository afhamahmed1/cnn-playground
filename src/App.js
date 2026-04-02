import './globals.css'
import './legacy-bridge.css'
import './responsive.css'
import React, { Suspense } from 'react'
import { ArrowUpRight, RefreshCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const h = React.createElement

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
  return h(
    Card,
    { className: 'border-dashed bg-muted/30 shadow-none' },
    h(
      CardHeader,
      { className: 'gap-4 sm:flex sm:flex-row sm:items-start sm:justify-between' },
      h(
        'div',
        { className: 'space-y-3' },
        h(Badge, { variant: 'secondary' }, 'shadcn ui migration'),
        h(
          'div',
          { className: 'space-y-1' },
          h(CardTitle, { className: 'text-xl' }, 'CNN Playground'),
          h(
            CardDescription,
            null,
            'The app now has a shadcn and Tailwind foundation, bridged tokens for the legacy markup, and a gradual component migration path.',
          ),
        ),
      ),
      h(
        'div',
        { className: 'flex flex-wrap gap-2' },
        h(
          Button,
          {
            variant: 'outline',
            size: 'sm',
            onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
          },
          'Back to top',
        ),
        h(
          Button,
          { variant: 'secondary', size: 'sm', asChild: true },
          h(
            'a',
            {
              href: 'https://github.com/afhamahmed1/cnn-playground',
              target: '_blank',
              rel: 'noreferrer',
            },
            'View repo',
            h(ArrowUpRight, { className: 'size-4' }),
          ),
        ),
      ),
    ),
  )
}

function LoadingFallback() {
  return h(
    'div',
    { className: 'min-h-screen bg-background px-4 py-10 text-foreground sm:px-6' },
    h(
      'div',
      { className: 'mx-auto flex max-w-7xl flex-col gap-6' },
      h(ShellIntro),
      h(
        Card,
        { className: 'mx-auto w-full max-w-xl' },
        h(
          CardHeader,
          null,
          h(CardTitle, null, 'Loading the playground'),
          h(CardDescription, null, 'The interactive CNN workspace is being prepared.'),
        ),
        h(
          CardContent,
          null,
          h(
            Button,
            { variant: 'secondary', size: 'sm', disabled: true },
            h(RefreshCcw, { className: 'size-4 animate-spin' }),
            'Loading',
          ),
        ),
      ),
    ),
  )
}

export default function AppBridge() {
  return h(
    Suspense,
    { fallback: h(LoadingFallback) },
    h(
      'div',
      { className: 'min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8' },
      h(
        'div',
        { className: 'mx-auto flex max-w-7xl flex-col gap-6' },
        h(ShellIntro),
        h(
          'div',
          { className: 'min-h-screen bg-background text-foreground' },
          h(LazyApp),
        ),
      ),
    ),
  )
}
