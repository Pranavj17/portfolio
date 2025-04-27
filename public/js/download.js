document.addEventListener('DOMContentLoaded', function() {
    const downloadButton = document.getElementById('download');
    const downloadMobileButton = document.getElementById('download-mobile');

    async function handleDownload(e) {
        e.preventDefault();
        e.stopPropagation();

        try {
            const response = await fetch('/download-resume');
            if (!response.ok) throw new Error('Network response was not ok');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'resume.pdf';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading PDF:', error);
            alert('Failed to download PDF. Please try again.');
        }
    }

    if (downloadButton) {
        downloadButton.addEventListener('click', handleDownload);
    }

    if (downloadMobileButton) {
        downloadMobileButton.addEventListener('click', handleDownload);
    }
});