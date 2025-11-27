const fileInput = document.getElementById('file');
const out = document.getElementById('out');
const previewImg = document.getElementById('previewImg');
const downloadShader = document.getElementById('downloadShader');
const downloadPreview = document.getElementById('downloadPreview');

function toFixed6(n){ return (n/255).toFixed(6); }

function buildShaderFromImage(imgName, img16Data) {
  // img16Data: Uint8ClampedArray length 16*16*4, row-major top->bottom left->right
  const lines = [];
  for(let y=0;y<16;y++){
    for(let x=0;x<16;x++){
      const i = (y*16 + x) * 4;
      let r = img16Data[i], g = img16Data[i+1], b = img16Data[i+2], a = img16Data[i+3];
      if(a < 255){
        const af = a/255;
        r = Math.round(r*af);
        g = Math.round(g*af);
        b = Math.round(b*af);
      }
      const comma = (y*16 + x) < 255 ? "," : "";
      lines.push("  vec3(" + toFixed6(r) + ", " + toFixed6(g) + ", " + toFixed6(b) + ")" + comma);
    }
  }

  const pixelsBlock = "const vec3 PIXELS[256] = vec3[256](\n" + lines.join("\n") + "\n);";

  const shader = [
    "#version 300 es",
    "precision mediump float;",
    "precision mediump int;",
    "out vec4 fragColor;",
    "uniform vec2 resolution;",
    pixelsBlock,
    "void main(){",
    "  vec2 uv=(gl_FragCoord.xy-vec2(0.5))/resolution;",
    "  int ix=int(clamp(floor(uv.x*16.0),0.0,15.0));",
    "  int iy=int(clamp(floor(uv.y*16.0),0.0,15.0));",
    "  int row_top=15-iy;",
    "  int idx=row_top*16+ix;",
    "  vec3 col=PIXELS[idx];",
    "  fragColor=vec4(col,1.0);",
    "}"
  ].join("\n");

  return shader;
}

function createPreviewBlob(img16Canvas){
  // return PNG blob of the 16x16 (upscaled to 256) for download/preview
  const up = document.createElement('canvas');
  up.width = 256; up.height = 256;
  const ctx = up.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img16Canvas, 0, 0, 16, 16, 0, 0, 256, 256);
  return new Promise(resolve => up.toBlob(resolve, 'image/png'));
}

fileInput.addEventListener('change', () => {
  const f = fileInput.files[0];
  if(!f) return;
  const img = new Image();
  const reader = new FileReader();
  reader.onload = e => img.src = e.target.result;
  reader.readAsDataURL(f);

  img.onload = async () => {
    // draw original to temp then scale with nearest
    const tmp = document.createElement('canvas');
    tmp.width = img.width; tmp.height = img.height;
    const tctx = tmp.getContext('2d', {alpha: true});
    tctx.drawImage(img, 0, 0);

    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const ctx = c.getContext('2d', {alpha: true});
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, 0, 0, 16, 16);

    const imgData = ctx.getImageData(0,0,16,16).data; // Uint8ClampedArray

    // build shader
    const shader = buildShaderFromImage(f.name, imgData);
    out.textContent = shader;

    // preview image (pixelated upscaling)
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = 256; previewCanvas.height = 256;
    const pctx = previewCanvas.getContext('2d');
    pctx.imageSmoothingEnabled = false;
    pctx.drawImage(c, 0, 0, 16, 16, 0, 0, 256, 256);
    previewImg.src = previewCanvas.toDataURL('image/png');

    // enable downloads
    const shaderBlob = new Blob([shader], {type: 'text/plain'});
    const shaderUrl = URL.createObjectURL(shaderBlob);
    downloadShader.href = shaderUrl;
    downloadShader.download = f.name.replace(/\.[^.]+$/, '') + "_16x16.frag";
    downloadShader.disabled = false;

    const previewBlob = await createPreviewBlob(c);
    const prevUrl = URL.createObjectURL(previewBlob);
    downloadPreview.href = prevUrl;
    downloadPreview.download = f.name.replace(/\.[^.]+$/, '') + "_preview_256.png";
    downloadPreview.disabled = false;
  };
});
