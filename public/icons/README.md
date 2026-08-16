# PWA Icon Generator for TactiBoard

This directory contains resources for generating PWA icons.

## Quick Start

1. Open `generate-icons.html` in a browser to see a basic icon preview
2. For production, create proper icons using one of these methods:

### Method 1: Online Generator (Recommended)
1. Create a 512x512 base icon with:
   - Background: #0f172a (dark slate)
   - Foreground: White football pitch or tactical symbol
   - Rounded corners for better maskable support
   
2. Use [RealFaviconGenerator](https://realfavicongenerator.net/) to generate all sizes

3. Download and place all PNG files in this `/icons` directory

### Method 2: Manual Creation
Use any image editor (Photoshop, GIMP, Canva, Figma) to create:
- icon-192x192.png (required)
- icon-512x512.png (required)

All should be the same design, just different sizes.

## Icon Requirements

- **Format**: PNG with transparency support
- **Design**: Simple, recognizable at small sizes
- **Colors**: Match app theme (#0f172a background)
- **Maskable**: Important for Android - keep important content within center 60%

## Testing

After adding icons:
1. Run `npm run build`
2. Serve with `npx serve dist`
3. Open in Chrome DevTools > Application > Manifest
4. Verify icons display correctly
5. Test "Add to Home Screen" functionality

## Note

The Vite PWA plugin only requires icon-192x192.png and icon-512x512.png. 
Other sizes will be generated automatically if needed by platforms.
