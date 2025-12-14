import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Expose to network (0.0.0.0) so you can test webcam on mobile via local IP
    host: true, 
    port: 5173,
  },
  optimizeDeps: {
    // Ensure these are pre-bundled to avoid reloading
    include: ['three', '@react-three/fiber', '@react-three/drei', 'three-stdlib']
  }
})