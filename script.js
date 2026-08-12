// Function to check if element is in viewport
function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// Function to handle scroll events
function handleScroll() {
    const whoruSection = document.querySelector('.whoru');
    if (isElementInViewport(whoruSection)) {
        whoruSection.classList.add('visible');
        // Remove scroll listener once animation is triggered
        //window.removeEventListener('scroll', handleScroll);
    }
}

// Add scroll event listener
window.addEventListener('scroll', handleScroll);
// Check initial state
handleScroll();
