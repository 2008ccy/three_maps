import AppKit

// Draw at each iconset resolution to keep the three stacked cards crisp in Finder.
let folder = URL(fileURLWithPath: CommandLine.arguments[1])
for points in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let pixels = points * scale
        let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels,
            bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
            bytesPerRow: 0, bitsPerPixel: 0)!
        let graphics = NSGraphicsContext(bitmapImageRep: rep)!
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = graphics
        let ctx = graphics.cgContext
        ctx.scaleBy(x: CGFloat(pixels) / 100, y: CGFloat(pixels) / 100)
        func rect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ radius: CGFloat,
                  _ red: CGFloat, _ green: CGFloat, _ blue: CGFloat) {
            ctx.setFillColor(red: red, green: green, blue: blue, alpha: 1)
            ctx.addPath(CGPath(roundedRect: CGRect(x: x, y: y, width: w, height: h),
                               cornerWidth: radius, cornerHeight: radius, transform: nil))
            ctx.fillPath()
        }
        rect(6, 6, 88, 88, 20, 0.07, 0.28, 0.29)
        rect(36, 37, 39, 39, 6, 0.36, 0.68, 0.61)
        rect(30, 31, 39, 39, 6, 0.66, 0.83, 0.72)
        rect(24, 25, 39, 39, 6, 0.98, 0.96, 0.84)
        rect(31, 48, 22, 3, 1.5, 0.10, 0.35, 0.34)
        rect(31, 40, 15, 3, 1.5, 0.10, 0.35, 0.34)
        NSGraphicsContext.restoreGraphicsState()
        let suffix = scale == 1 ? "" : "@2x"
        let url = folder.appendingPathComponent("icon_\(points)x\(points)\(suffix).png")
        try rep.representation(using: .png, properties: [:])!.write(to: url)
    }
}
