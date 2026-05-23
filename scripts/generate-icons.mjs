import sharp from 'sharp'
import { mkdirSync } from 'fs'

mkdirSync('public', { recursive: true })

// Purple-to-pink gradient calendar icon
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6c63ff"/>
      <stop offset="50%" stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
  </defs>
  <!-- Background rounded rect -->
  <rect width="512" height="512" rx="100" fill="url(#bg)"/>
  <!-- Calendar body -->
  <rect x="96" y="152" width="320" height="272" rx="28" fill="white" fill-opacity="0.18"/>
  <rect x="96" y="152" width="320" height="272" rx="28" fill="none" stroke="white" stroke-width="16" stroke-opacity="0.9"/>
  <!-- Header band -->
  <path d="M96 180 Q96 152 124 152 L388 152 Q416 152 416 180 L416 218 L96 218 Z" fill="white" fill-opacity="0.3"/>
  <!-- Calendar ring left -->
  <rect x="176" y="120" width="28" height="64" rx="14" fill="white"/>
  <!-- Calendar ring right -->
  <rect x="308" y="120" width="28" height="64" rx="14" fill="white"/>
  <!-- Grid dots — row 1 -->
  <rect x="136" y="252" width="44" height="36" rx="8" fill="white" fill-opacity="0.85"/>
  <rect x="196" y="252" width="44" height="36" rx="8" fill="white" fill-opacity="0.85"/>
  <rect x="256" y="252" width="44" height="36" rx="8" fill="white" fill-opacity="0.85"/>
  <rect x="316" y="252" width="44" height="36" rx="8" fill="white" fill-opacity="0.85"/>
  <!-- Grid dots — row 2 -->
  <rect x="136" y="304" width="44" height="36" rx="8" fill="white" fill-opacity="0.85"/>
  <rect x="196" y="304" width="44" height="36" rx="8" fill="white" fill-opacity="0.85"/>
  <rect x="256" y="304" width="44" height="36" rx="8" fill="white" fill-opacity="0.85"/>
  <!-- Grid dots — row 3 -->
  <rect x="136" y="356" width="44" height="36" rx="8" fill="white" fill-opacity="0.6"/>
  <rect x="196" y="356" width="44" height="36" rx="8" fill="white" fill-opacity="0.6"/>
  <rect x="256" y="356" width="100" height="36" rx="8" fill="white" fill-opacity="0.4"/>
</svg>`

const buf = Buffer.from(svg)

await sharp(buf).resize(512, 512).png().toFile('public/pwa-512x512.png')
await sharp(buf).resize(192, 192).png().toFile('public/pwa-192x192.png')
await sharp(buf).resize(180, 180).png().toFile('public/apple-touch-icon.png')
await sharp(buf).resize(32,  32 ).png().toFile('public/favicon.png')

console.log('✓ Icons generated in public/')
