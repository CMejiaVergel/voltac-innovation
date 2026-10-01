# Exporta un artefacto de innovación (brochure o protocepto) desde su HTML:
# mide desbordes, imprime el PDF junto al HTML y deja una captura para revisarlo.
#
#   powershell -File scripts\exportar-artefacto.ps1 -Html "<ruta>\Concepto 02 - Brochure ... v2.html"
#
# Usa Microsoft Edge en modo headless: no hace falta instalar nada más.
# Las hojas se detectan por la clase .hoja (brochure A4) o .slide (protocepto 16:9).
param(
  [Parameter(Mandatory = $true)][string]$Html,
  [string]$Captura
)
$ErrorActionPreference = 'Stop'

$edge = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'No se encontró Microsoft Edge.' }

$Html = (Resolve-Path $Html).Path
$contenido = Get-Content $Html -Raw -Encoding UTF8
$selector = if ($contenido -match 'class="slide') { '.slide' } else { '.hoja' }
$trabajo = Join-Path $env:TEMP "exportar-artefacto"
New-Item -ItemType Directory -Force $trabajo | Out-Null
$perfil = Join-Path $trabajo 'perfil-edge'

function Invocar-Edge([string[]]$argumentos, [string]$salida) {
  $base = @('--headless=new', '--disable-gpu', "--user-data-dir=`"$perfil`"", '--virtual-time-budget=4000')
  $p = @{ FilePath = $edge; ArgumentList = $base + $argumentos; Wait = $true; NoNewWindow = $true; RedirectStandardError = (Join-Path $trabajo 'edge.err') }
  if ($salida) { $p.RedirectStandardOutput = $salida }
  Start-Process @p
}
function Url([string]$ruta) { 'file:///' + (($ruta -replace '\\', '/') -replace ' ', '%20') }

# 1. Medición: copia temporal con un script que reporta recortes y bloques fuera de su hoja.
$medidor = @"
<script>
window.addEventListener('load',()=>{const out=[];
document.querySelectorAll('$selector').forEach((h,i)=>{
  const hb=h.getBoundingClientRect(); const det=[];
  h.querySelectorAll('*').forEach(e=>{
    const r=e.getBoundingClientRect();
    if(r.height>0 && r.bottom>hb.bottom+1){det.push('  fuera de la hoja: <'+e.tagName.toLowerCase()+' class="'+e.className+'"> +'+Math.round(r.bottom-hb.bottom)+'px');}
    if(e!==h && getComputedStyle(e).overflow!=='visible' && e.scrollHeight>e.clientHeight+2){det.push('  recortado: <'+e.tagName.toLowerCase()+' class="'+e.className+'"> '+e.clientHeight+'/'+e.scrollHeight+'px');}
  });
  const cont=h.querySelector('.pad,.body,.h1grid'); let hueco='';
  if(cont && cont.lastElementChild){hueco=' - hueco al pie '+Math.round(cont.getBoundingClientRect().bottom-cont.lastElementChild.getBoundingClientRect().bottom)+'px';}
  out.push('Hoja '+(i+1)+': '+(det.length?det.length+' problema(s)':'ok')+hueco, ...det);
});
const pre=document.createElement('pre');pre.id='MEDIDA';pre.textContent=out.join('\n');document.body.appendChild(pre);});
</script>
"@
$tmp = Join-Path $trabajo 'medir.html'
[IO.File]::WriteAllText($tmp, $contenido.Replace('</body>', $medidor + '</body>'), [Text.UTF8Encoding]::new($false))
$dom = Join-Path $trabajo 'dom.txt'
Invocar-Edge @('--window-size=1400,2000', '--dump-dom', "`"$(Url $tmp)`"") $dom
$m = [regex]::Match((Get-Content $dom -Raw -Encoding UTF8), '<pre id="MEDIDA">([\s\S]*?)</pre>')
Write-Output ($m.Groups[1].Value -replace '&lt;', '<' -replace '&gt;', '>' -replace '&quot;', '"')

# 2. PDF junto al HTML, con el mismo nombre.
$pdf = [IO.Path]::ChangeExtension($Html, '.pdf')
Invocar-Edge @('--no-pdf-header-footer', "--print-to-pdf=`"$pdf`"", "`"$(Url $Html)`"")
$paginas = ([regex]::Matches([Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes($pdf)), '/Type\s*/Page[^s]')).Count
Write-Output "PDF: $pdf ($paginas páginas)"

# 3. Captura de todo el documento para revisarlo a ojo.
if (-not $Captura) { $Captura = Join-Path $trabajo (([IO.Path]::GetFileNameWithoutExtension($Html)) + '.png') }
$ventana = if ($selector -eq '.slide') { '1320,2380' } else { '830,2320' }
Invocar-Edge @("--window-size=$ventana", '--hide-scrollbars', "--screenshot=`"$Captura`"", "`"$(Url $Html)`"")
Write-Output "Captura: $Captura"
