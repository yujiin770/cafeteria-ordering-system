// This function fetches HTML content and injects it into a specified element
async function loadPartial(elementId, filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`Could not load ${filePath}`);
        const text = await response.text();
        document.getElementById(elementId).innerHTML = text;
    } catch (error) {
        console.error('Error loading partial:', error);
    }
}

// When the page loads, load all the partial HTML components
window.addEventListener('DOMContentLoaded', () => {
    loadPartial('header-placeholder', '../partials/_header.html');
    loadPartial('sidebar-placeholder', '../partials/_sidebar.html');
    loadPartial('footer-placeholder', '../partials/_footer.html');
});