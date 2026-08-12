// Function to check if element is in viewport
function isElementInViewport(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return (
        rect.top < (window.innerHeight || document.documentElement.clientHeight) &&
        rect.bottom > 0
    );
}

// Function to handle scroll events
function handleScroll() {
    document.querySelectorAll('.whoru, .table-stage').forEach((section) => {
        if (isElementInViewport(section)) {
            section.classList.add('visible');
        }
    });
}

// Add scroll event listener
window.addEventListener('scroll', handleScroll);
// Check initial state
handleScroll();
