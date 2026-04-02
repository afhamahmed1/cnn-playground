# CNN Playground

A React + Vite playground for experimenting with:

- receptive fields
- editable input grids
- editable and addable kernels
- convolution / activation / pooling feature maps
- a tiny FFN classification head
- logits, softmax, and cross-entropy loss
- backpropagation and multi-step training

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## Publish on GitHub Pages

1. Go to **Settings → Pages**
2. Under **Build and deployment**, set **Source** to **GitHub Actions**

The included workflow at `.github/workflows/deploy.yml` will build and publish the app automatically on pushes to `main`.
