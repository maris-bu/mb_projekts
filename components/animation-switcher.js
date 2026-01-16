/**
 * Animation Switcher Component
 * Switches animations on various events (hover, click, proximity, etc.)
 * 
 * Usage examples:
 *   animation-on-hover="defaultClip: Idle; hoverClip: Wave"
 *   animation-on-hover="defaultClip: Idle; hoverClip: Dance; clickClip: Jump"
 *   animation-on-hover="defaultClip: Idle; hoverClip: Alert; proximityClip: Attack; proximityDistance: 3"
 */
AFRAME.registerComponent('animation-on-hover', {
  schema: {
    // Animation clips
    defaultClip: {type: 'string', default: 'Idle'},
    hoverClip: {type: 'string', default: ''},
    clickClip: {type: 'string', default: ''},
    proximityClip: {type: 'string', default: ''},
    
    // Animation settings
    loop: {type: 'string', default: 'repeat'},      // repeat, once, pingpong
    crossFadeDuration: {type: 'number', default: 0.3},
    timeScale: {type: 'number', default: 1},
    
    // Proximity settings
    proximityDistance: {type: 'number', default: 2},
    proximityTarget: {type: 'selector', default: '[camera]'},
    
    // Behavior settings
    clickOnce: {type: 'boolean', default: true},    // Play click animation once then return
    debug: {type: 'boolean', default: false}
  },

  init: function () {
    this.el.classList.add('clickable');
    
    this.currentClip = this.data.defaultClip;
    this.isHovering = false;
    this.isInProximity = false;
    this.bindMethods();
    this.addEventListeners();
    this.addClickableToChildren();
    
    // Set initial animation
    this.playAnimation(this.data.defaultClip);
    
    this.log('Animation switcher initialized');
  },

  addClickableToChildren: function () {
    // Add clickable class to all child A-Frame entities
    var children = this.el.querySelectorAll('*');
    for (var i = 0; i < children.length; i++) {
      children[i].classList.add('clickable');
    }
  },

  bindMethods: function () {
    this.onMouseEnter = this.onMouseEnter.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.onClick = this.onClick.bind(this);
  },

  addEventListeners: function () {
    var el = this.el;
    
    if (this.data.hoverClip) {
      el.addEventListener('mouseenter', this.onMouseEnter);
      el.addEventListener('mouseleave', this.onMouseLeave);
    }
    
    if (this.data.clickClip) {
      el.addEventListener('click', this.onClick);
    }
  },

  removeEventListeners: function () {
    var el = this.el;
    el.removeEventListener('mouseenter', this.onMouseEnter);
    el.removeEventListener('mouseleave', this.onMouseLeave);
    el.removeEventListener('click', this.onClick);
  },

  onMouseEnter: function () {
    this.isHovering = true;
    this.log('Mouse enter - switching to:', this.data.hoverClip);
    this.playAnimation(this.data.hoverClip);
  },

  onMouseLeave: function () {
    this.isHovering = false;
    this.log('Mouse leave - switching to:', this.data.defaultClip);
    this.playAnimation(this.data.defaultClip);
  },

  onClick: function () {
    this.log('Click - playing:', this.data.clickClip);
    
    if (this.data.clickOnce) {
      // Play once then return to previous state
      this.playAnimation(this.data.clickClip, 'once');
      
      // Get animation duration and return to default/hover after
      var self = this;
      var mixer = this.el.components['animation-mixer'];
      if (mixer && mixer.mixer) {
        var clip = mixer.mixer._actions.find(function(a) { 
          return a._clip && a._clip.name === self.data.clickClip; 
        });
        var duration = clip && clip._clip ? clip._clip.duration * 1000 : 1000;
        
        setTimeout(function() {
          var returnClip = self.isHovering ? self.data.hoverClip : self.data.defaultClip;
          self.playAnimation(returnClip);
        }, duration / self.data.timeScale);
      }
    } else {
      this.playAnimation(this.data.clickClip);
    }
  },

  tick: function () {
    // Check proximity if proximityClip is set
    if (!this.data.proximityClip || !this.data.proximityTarget) return;
    
    var targetPos = this.data.proximityTarget.object3D.position;
    var myPos = this.el.object3D.position;
    var distance = targetPos.distanceTo(myPos);
    
    var wasInProximity = this.isInProximity;
    this.isInProximity = distance < this.data.proximityDistance;
    
    if (this.isInProximity && !wasInProximity) {
      this.log('Entered proximity - switching to:', this.data.proximityClip);
      this.playAnimation(this.data.proximityClip);
    } else if (!this.isInProximity && wasInProximity && !this.isHovering) {
      this.log('Left proximity - switching to:', this.data.defaultClip);
      this.playAnimation(this.data.defaultClip);
    }
  },

  playAnimation: function (clipName, loopOverride) {
    if (!clipName) return;
    
    this.currentClip = clipName;
    this.el.setAttribute('animation-mixer', {
      clip: clipName,
      loop: loopOverride || this.data.loop,
      crossFadeDuration: this.data.crossFadeDuration,
      timeScale: this.data.timeScale
    });
  },

  log: function () {
    if (this.data.debug) {
      console.log.apply(console, ['[animation-switcher]'].concat(Array.prototype.slice.call(arguments)));
    }
  },

  remove: function () {
    this.removeEventListeners();
  }
});