const handlePreviewDocument = (document) => {
  try {
    // Open preview modal with processed content
    openPreviewModal(document);
  } catch (error) {
    console.error('Error previewing document:', error);
  }
}; 