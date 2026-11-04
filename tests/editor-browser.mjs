import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const pdfPath=path.join(os.tmpdir(), 'pdf-editor-smoke.pdf');
let s='%PDF-1.4\n';const offsets=[0];const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 500] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>',null,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 500] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>',null,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
for(const [i,text] of [[3,'First page'],[5,'Second page']]) {const content=`BT /F1 24 Tf 40 400 Td (${text}) Tj ET`;objects[i]=`<< /Length ${content.length} >>\nstream\n${content}\nendstream`;}
objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(s));s+=`${i+1} 0 obj\n${o}\nendobj\n`;});const x=Buffer.byteLength(s);s+=`xref\n0 8\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;fs.writeFileSync(pdfPath,s);

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined,headless:true,args:['--no-sandbox']});
 try {
 const page=await browser.newPage({viewport:{width:1500,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_URL || 'http://localhost:3003');
 await page.locator('input[aria-label="PDFファイルを選択"]').setInputFiles(pdfPath);
 await page.locator('.edit-overlay canvas').waitFor();
 const overlay=page.locator('.edit-overlay');
 await page.getByRole('button',{name:'文字を追加',exact:true}).click();await overlay.click({position:{x:70,y:90}});
 await page.getByLabel('文字の内容').fill('日本語の編集\n二行目');await page.getByLabel('文字サイズ').fill('28');await page.getByRole('button',{name:'変更を適用'}).click();
 await page.getByRole('button',{name:'Undo',exact:true}).click();await page.getByRole('button',{name:'Redo',exact:true}).click();
 await page.getByRole('button',{name:'1: 日本語の編集'}).click();
 assert.equal(await page.getByLabel('文字の内容').inputValue(),'日本語の編集\n二行目');
 await page.getByRole('button',{name:'拡大',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.edit-overlay canvas').style.width==='500px');
 await page.getByRole('button',{name:'次のページ'}).click();assert.equal(await page.locator('.object-list button').count(),0);
 await page.getByRole('button',{name:'前のページ'}).click();await page.getByRole('button',{name:'1: 日本語の編集'}).waitFor();
 await page.getByRole('button',{name:'ハイライトを追加',exact:true}).click();await overlay.click({position:{x:260,y:300}});
 await page.getByLabel('色', {exact:true}).fill('#ff0000');await page.getByLabel('不透明度').fill('0.6');await page.getByRole('button',{name:'変更を適用'}).click();
 const box=await overlay.boundingBox();await page.mouse.move(box.x+270,box.y+310);await page.mouse.down();await page.mouse.move(box.x+300,box.y+350,{steps:5});await page.mouse.up();
 await page.getByRole('button',{name:'選択要素を削除'}).click();assert.equal(await page.locator('.object-list button').count(),1);await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal(await page.locator('.object-list button').count(),2);
 await page.locator('input[aria-label="画像ファイルを選択"]').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
 await page.getByRole('button',{name:'3: 画像',exact:true}).waitFor();
 const beforeResize=await overlay.screenshot();
 const imageBox=await overlay.boundingBox();
 await page.mouse.move(imageBox.x+225,imageBox.y+225);await page.mouse.down();await page.mouse.move(imageBox.x+270,imageBox.y+270,{steps:5});await page.mouse.up();
 assert.notDeepEqual(await overlay.screenshot(),beforeResize);
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 assert.equal(await page.locator('.object-list button').count(),3);
 await page.getByRole('button',{name:'Redo',exact:true}).click();
 assert.equal(await page.locator('.object-list button').count(),3);assert.deepEqual(errors,[]);
 console.log('PASS: Japanese text, properties, undo/redo, zoom, page isolation, highlight drag/delete, image upload');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
