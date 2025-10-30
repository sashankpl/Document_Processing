function showFileName(event) {
    const fileName = event.target.files[0] ? event.target.files[0].name : 'No file selected';
    document.getElementById('file-name').textContent = fileName;
  }

  // Show spinner on form submit
  function showSpinner() {
    document.getElementById('loading-spinner').style.display = 'block';
  }

  document.getElementById('fileInput').addEventListener('change', function() {
    // Automatically submit the form when a file is selected
    document.getElementById('uploadForm').submit();
  });


  