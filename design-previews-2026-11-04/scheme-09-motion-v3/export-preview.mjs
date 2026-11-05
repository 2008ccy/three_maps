import sharp from '/Users/changyichen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs';
const folder="/Users/changyichen/Developer/projects/three_maps/design-previews-2026-11-04/scheme-09-motion-v3";
await sharp(folder+'/scheme-09-matched-particle-loop-v3.gif',{animated:true,limitInputPixels:false})
.resize({width:960})
.gif({colours:192,dither:0,effort:7,interFrameMaxError:2,interPaletteMaxError:256,loop:0,delay:Array(160).fill(50),keepDuplicateFrames:true})
.toFile(folder+'/scheme-09-matched-preview-v3.gif');
console.log('compact ready');
