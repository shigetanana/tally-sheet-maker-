document.addEventListener('DOMContentLoaded', () => {
    const imageUpload = document.getElementById('image-upload');
    const fileNameDisplay = document.getElementById('file-name');
    const loadingState = document.getElementById('loading-state');
    const cropSection = document.getElementById('crop-section');
    const cropperImage = document.getElementById('cropper-image');
    const extractBtn = document.getElementById('extract-btn');
    const editSection = document.getElementById('edit-section');
    const performerList = document.getElementById('performer-list');
    const newPerformerInput = document.getElementById('new-performer-input');
    const addPerformerBtn = document.getElementById('add-performer-btn');
    const printBtn = document.getElementById('print-btn');
    const previewPanel = document.getElementById('preview-panel');
    const sheetPreview = document.getElementById('sheet-preview');
    const printTbody = document.getElementById('print-tbody');
    const extractErrorMsg = document.getElementById('extract-error-msg');
    const csvOutput = document.getElementById('csv-output');
    const copyCsvBtn = document.getElementById('copy-csv-btn');
    let performers = [];
    let cropper = null;
    
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
    
    function initCropper(imageSrc) {
        document.querySelector('.crop-container').innerHTML = '<img id="cropper-image" src="">';
        const newCropperImage = document.getElementById('cropper-image');
        newCropperImage.src = imageSrc;
        cropSection.classList.remove('hidden');
        
        cropper = new Cropper(newCropperImage, {
            viewMode: 1,
            dragMode: 'crop',
            autoCropArea: 0.8,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: true,
            zoomOnWheel: false,
            zoomOnTouch: false,
        });
    }

    imageUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        fileNameDisplay.textContent = file.name;
        
        // Hide previous UI states
        editSection.classList.add('hidden');
        previewPanel.classList.add('hidden');
        printBtn.classList.add('hidden');
        
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }

        if (file.type === 'application/pdf') {
            document.querySelector('.crop-container').innerHTML = '<div style="padding: 3rem 1rem; text-align: center; color: #4b5563;">PDFを画像に変換しています...</div>';
            cropSection.classList.remove('hidden');

            try {
                if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                }

                const arrayBuffer = await file.arrayBuffer();
                const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const page = await pdf.getPage(1); // Read first page
                const viewport = page.getViewport({ scale: 2.0 }); // High quality

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;

                const imgDataUrl = canvas.toDataURL('image/jpeg', 0.95);
                initCropper(imgDataUrl);
            } catch (error) {
                console.error('PDF rendering error:', error);
                document.querySelector('.crop-container').innerHTML = '<div style="padding: 3rem 1rem; text-align: center; color: #ef4444;">PDFの読み込みに失敗しました。</div>';
            }
        } else {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                initCropper(reader.result);
            };
        }
    });

    extractBtn.addEventListener('click', async () => {
        extractErrorMsg.textContent = ''; // Clear previous errors
        
        if (!cropper) {
            extractErrorMsg.textContent = 'ファイルが正しく読み込まれていません。再度ファイルを選択してください。';
            return;
        }


        // Show loading
        cropSection.classList.add('hidden');
        loadingState.classList.remove('hidden');
        document.getElementById('loading-text').textContent = 'AIで文字を認識しています...';

        try {
            const canvas = cropper.getCroppedCanvas();
            const base64Data = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];

            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imageBase64: base64Data
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || 'API request failed');
            }

            const result = await response.json();
            let text = '';
            if (result.candidates && result.candidates.length > 0) {
                text = result.candidates[0].content.parts[0].text;
            }

            // Process Text
            performers = text.split('\n')
                             .map(line => line.trim())
                             .map(line => line.replace(/^[\-\*・\d\.．]+\s*/, ''))
                             .filter(line => line.length > 0);

            // Show Editor
            loadingState.classList.add('hidden');
            
            renderEditor();
            editSection.classList.remove('hidden');
            previewPanel.classList.remove('hidden');
            printBtn.classList.remove('hidden');

        } catch (error) {
            console.error("Gemini API Error:", error);
            extractErrorMsg.textContent = "画像からの読み取りに失敗しました。APIキーが正しいか確認してください。詳細: " + error.message;
            loadingState.classList.add('hidden');
            cropSection.classList.remove('hidden');
        }
    });

    function renderEditor() {
        performerList.innerHTML = '';
        performers.forEach((name, index) => {
            const item = document.createElement('div');
            item.className = 'performer-item';
            
            const input = document.createElement('input');
            input.type = 'text';
            input.value = name;
            input.addEventListener('change', (e) => {
                performers[index] = e.target.value;
                updatePreviewAndPrint();
            });

            const delBtn = document.createElement('button');
            delBtn.innerHTML = '✕';
            delBtn.title = '削除';
            delBtn.addEventListener('click', () => {
                performers.splice(index, 1);
                renderEditor();
            });

            item.appendChild(input);
            item.appendChild(delBtn);
            performerList.appendChild(item);
        });

        updatePreviewAndPrint();
    }

    addPerformerBtn.addEventListener('click', () => {
        const name = newPerformerInput.value.trim();
        if (name) {
            performers.push(name);
            newPerformerInput.value = '';
            renderEditor();
        }
    });

    newPerformerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addPerformerBtn.click();
        }
    });

    if (copyCsvBtn && csvOutput) {
        copyCsvBtn.addEventListener('click', () => {
            csvOutput.select();
            document.execCommand('copy');
            const originalText = copyCsvBtn.textContent;
            copyCsvBtn.textContent = 'コピー完了!';
            setTimeout(() => {
                copyCsvBtn.textContent = originalText;
            }, 2000);
        });
    }

    function updatePreviewAndPrint() {
        // Filter out empty names
        const validPerformers = performers.filter(p => p.trim() !== '');

        function getFontSizeStyle(name) {
            // 固定のフォントサイズで、長い場合は折り返して全体を表示する
            return `font-size: 14px; white-space: normal; word-break: break-word; line-height: 1.2; width: 100%; box-sizing: border-box;`;
        }

        // 1. Update Preview Panel (Miniature view on screen)
        let previewHtml = '<table style="table-layout: fixed;"><colgroup><col style="width: 5%;"><col style="width: 20%;"><col style="width: 6.5%;"><col style="width: 6.5%;"><col style="width: 6.5%;"><col style="width: 6.5%;"><col style="width: 6.5%;"><col style="width: 6.5%;"><col style="width: 6.5%;"><col style="width: 6.5%;"><col style="width: 6.5%;"><col style="width: 6.5%;"><col style="width: 10%;"></colgroup><thead><tr><th>順番</th><th>演者名</th><th colspan="10">カウント</th><th>合計</th></tr></thead><tbody>';
        validPerformers.forEach((name, index) => {
            const fontStyle = getFontSizeStyle(name);
            previewHtml += `<tr><td class="no-cell" style="text-align: center; font-weight: bold;">${index + 1}</td><td class="name-cell"><div style="${fontStyle}">${escapeHtml(name)}</div></td>`;
            for (let i = 0; i < 10; i++) {
                previewHtml += `<td class="tally-box"></td>`;
            }
            previewHtml += `<td class="total-box"></td></tr>`;
        });
        previewHtml += '</tbody></table>';
        sheetPreview.innerHTML = previewHtml;

        if (csvOutput) {
            csvOutput.value = validPerformers.join(', ');
        }

        // 2. Update Real Print Layout
        let printHtml = '';
        validPerformers.forEach((name, index) => {
            const fontStyle = getFontSizeStyle(name);
            printHtml += `<tr><td class="no-cell" style="text-align: center; font-weight: bold;">${index + 1}</td><td class="name-cell"><div style="${fontStyle}">${escapeHtml(name)}</div></td>`;
            for (let i = 0; i < 10; i++) {
                printHtml += `<td class="tally-box"></td>`;
            }
            printHtml += `<td class="total-box"></td></tr>`;
        });
        printTbody.innerHTML = printHtml;
    }

    printBtn.addEventListener('click', async () => {
        const printLayout = document.getElementById('print-layout');

        try {
            printBtn.textContent = 'PDF生成中...';
            printBtn.disabled = true;

            // Show element off-screen
            printLayout.classList.add('active-for-pdf');
            
            // Short delay to ensure DOM is fully rendered
            await new Promise(resolve => setTimeout(resolve, 100));

            // Snap a picture of the layout
            const canvas = await html2canvas(printLayout, { 
                scale: 2, 
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            
            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            
            // Create A4 PDF (210mm x 297mm)
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            // Mathematically scale the image to fit EXACTLY on one page
            const ratio = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height);
            const imgWidth = canvas.width * ratio;
            const imgHeight = canvas.height * ratio;
            
            // Center horizontally, stick to top
            const x = (pdfWidth - imgWidth) / 2;
            const y = 0;
            
            pdf.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight);
            
            if (window.showSaveFilePicker) {
                const pdfBlob = pdf.output('blob');
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: 'tally_sheet.pdf',
                        types: [{
                            description: 'PDF Document',
                            accept: {'application/pdf': ['.pdf']},
                        }],
                    });
                    const writable = await handle.createWritable();
                    await writable.write(pdfBlob);
                    await writable.close();
                } catch (e) {
                    if (e.name !== 'AbortError') throw e;
                }
            } else {
                pdf.save('tally_sheet.pdf');
            }
        } catch (error) {
            console.error('PDF generation error:', error);
            alert('PDFの保存に失敗しました。');
        } finally {
            printLayout.classList.remove('active-for-pdf'); // Hide again
            printBtn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1-2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg> PDFを保存...';
            printBtn.disabled = false;
        }
    });
});
