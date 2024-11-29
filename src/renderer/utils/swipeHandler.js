export class SwipeHandler {
  constructor(element, onSwipeLeft, onSwipeRight) {
    this.element = element;
    this.startX = 0;
    this.endX = 0;
    this.minSwipeDistance = 50;
    this.isDragging = false;

    this.onSwipeLeft = onSwipeLeft;
    this.onSwipeRight = onSwipeRight;

    this.init();
  }

  init() {
    // Touch Events
    this.element.addEventListener('touchstart', e => {
      this.startX = e.changedTouches[0].screenX;
      this.addVisualFeedback(e.changedTouches[0].clientX);
    }, { passive: true });

    this.element.addEventListener('touchmove', e => {
      this.handleMove(e.changedTouches[0].clientX);
    }, { passive: true });

    this.element.addEventListener('touchend', e => {
      this.endX = e.changedTouches[0].screenX;
      this.handleSwipeEnd();
    }, { passive: true });

    // Mouse Events
    this.element.addEventListener('mousedown', e => {
      this.isDragging = true;
      this.startX = e.screenX;
      this.addVisualFeedback(e.clientX);
    });

    this.element.addEventListener('mousemove', e => {
      if (this.isDragging) {
        this.handleMove(e.clientX);
      }
    });

    this.element.addEventListener('mouseup', e => {
      if (this.isDragging) {
        this.endX = e.screenX;
        this.isDragging = false;
        this.handleSwipeEnd();
      }
    });

    // Handle mouse leaving the element
    this.element.addEventListener('mouseleave', e => {
      if (this.isDragging) {
        this.isDragging = false;
        this.element.style.backgroundColor = '';
      }
    });
  }

  addVisualFeedback(clientX) {
    this.element.style.cursor = 'grab';
    this.element.style.userSelect = 'none';
  }

  handleMove(clientX) {
    const swipeDistance = clientX - this.startX;
    if (Math.abs(swipeDistance) > 20) {
      const opacity = Math.min(Math.abs(swipeDistance) / 200, 0.5);
      this.element.style.backgroundColor = swipeDistance > 0 ?
        `rgba(45, 153, 45, ${opacity})` :  // Green for accept
        `rgba(204, 53, 53, ${opacity})`;   // Red for reject
      this.element.style.cursor = 'grabbing';
    }
  }

  handleSwipeEnd() {
    const swipeDistance = this.endX - this.startX;

    // Reset styles
    this.element.style.backgroundColor = '';
    this.element.style.cursor = '';
    this.element.style.userSelect = '';

    if (Math.abs(swipeDistance) > this.minSwipeDistance) {
      if (swipeDistance > 0) {
        this.onSwipeRight?.();
      } else {
        this.onSwipeLeft?.();
      }
    }
  }
}
