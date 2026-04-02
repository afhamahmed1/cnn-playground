# CNN Playground

CNN Playground is an interactive **React + Vite** app for exploring how a small convolutional network behaves from input all the way to loss and backpropagation.

Instead of presenting CNN concepts as static diagrams, the app lets you **draw an input**, **edit kernels**, **inspect receptive fields**, **see feature maps update live**, and **run training steps** through a tiny classifier head.

## What the app does

The UI is organized into a set of hands-on sections:

### Input studio
- choose from synthetic presets like **Ring**, **Checkerboard**, **Bars**, and **Blob**
- paint directly on the input grid
- change brush mode, brush size, brush value, and input resolution

### Receptive field explorer
- inspect how convolution and pooling layers change the receptive field
- click a stage and cell to see its theoretical footprint overlaid on the original input
- view output size, effective kernel size, jump, and receptive field size for each layer

### Kernel studio
- edit kernel weights directly
- rename kernels and update their descriptions
- resize kernels
- add, duplicate, and remove custom kernels

### Forward feature maps
- view the pipeline through:
  - input
  - raw convolution
  - activation output
  - pooling output
- switch between **ReLU**, **tanh**, **sigmoid**, or no activation
- switch between **max pooling** and **average pooling**

### FFN head, softmax, and loss
- flatten pooled features into a small dense head
- inspect hidden activations, logits, and softmax probabilities
- choose a target class and observe the cross-entropy loss

### Backpropagation and training
- run a single training step or multiple training steps
- view beginner and technical backprop visualizations
- inspect gradients for logits, pooled features, input pixels, and kernel weights
- watch the loss before and after updates

### Architecture controls
- add and remove convolution and pooling layers
- change kernel size, stride, padding, dilation, and layer type
- see how those changes affect receptive field calculations and downstream views

## Why this repo exists

This project is designed as a visual learning tool for CNN fundamentals, especially:
- convolution behavior
- activation and pooling effects
- receptive field growth
- dense classification heads
- softmax and cross-entropy
- gradient flow during backpropagation

It is not a production ML training system. It is a browser-based playground focused on intuition, experimentation, and visualization.

## Tech stack

- **React** for the UI
- **Vite** for development and build tooling
- plain CSS for styling and layout
- GitHub Pages support via Vite base path configuration and a GitHub Actions deployment workflow

## Local development

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

## Production build

Create a production build and preview it locally:

```bash
npm run build
npm run preview
```

## GitHub Pages deployment

The repo is configured for GitHub Pages with the app served from the repository base path.

1. Go to **Settings → Pages**
2. Under **Build and deployment**, set **Source** to **GitHub Actions**
3. Push to `main`

The included workflow at `.github/workflows/deploy.yml` builds and publishes the site automatically.

## Project structure

```text
src/
  App.jsx          Main playground UI and CNN visualization logic
  App.js           Import shim for the app entry plus runtime helper setup
  styles.css       Base styling
  responsive.css   Mobile and tablet layout overrides
  main.jsx         React entrypoint
```

## Current status

The repo currently includes:
- the interactive CNN playground UI
- responsive layout improvements for smaller screens
- a GitHub Pages deployment workflow

If you want to extend it, the next logical improvements would be:
- multiple convolution channels
- side-by-side architecture presets
- saved presets / shareable configurations
- richer educational annotations or walkthrough mode
