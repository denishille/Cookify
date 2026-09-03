import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_BASE wird im GitHub-Pages-Workflow auf "/<repo-name>/" gesetzt.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/',
})
