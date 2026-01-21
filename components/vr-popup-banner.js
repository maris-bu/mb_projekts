/**
 * VR POPUP BANNER COMPONENT
 * ========================
 * Shows three floating banners in the upper left corner of the camera
 * in VR mode, displaying pottery object images.
 * Banners are expandable - trigger to show more details.
 * 
 * Usage:
 * <a-entity vr-popup-banner></a-entity>
 */

AFRAME.registerComponent("vr-popup-banner", {
  schema: {
    distance: { type: "number", default: 2.5 },
    width: { type: "number", default: 0.25 },
    height: { type: "number", default: 0.2 },
    spacing: { type: "number", default: 0.6 }
  },

  init() {
    this.camera = document.querySelector("[camera]");
    this.banners = [];
    this.expandedBanner = null;
    this.setupBanners();
  },

  setupBanners() {
    // Banner data with image paths - arranged horizontally
    const bannerData = [
      {
        id: "banner-1",
        image: "objects/ozolins_2_fake.png",
        xOffset: -0.35,  // Left banner
        title: "Ceramic Vase",
        description: "A beautiful handcrafted ceramic vase"
      },
      {
        id: "banner-2",
        image: "objects/ceramic_vase_3d_Krievs.png",
        xOffset: 0,      // Center banner
        title: "Vase by Krievs",
        description: "An elegant pottery piece by master craftsman"
      },
      {
        id: "banner-3",
        image: "objects/ceramic_jug_Dranda_2.png",
        xOffset: 0.35,   // Right banner
        title: "Ceramic Jug",
        description: "A traditional ceramic jug from the collection"
      }
    ];

    bannerData.forEach((data, index) => {
      // Create banner container
      const bannerContainer = document.createElement("a-entity");
      bannerContainer.setAttribute("id", data.id);
      bannerContainer.setAttribute("class", "expandable-banner");
      // Positioned horizontally in upper center area
      bannerContainer.setAttribute("position", `${data.xOffset} 0.4 -${this.data.distance}`);
      bannerContainer.setAttribute("rotation", "0 0 0");
      bannerContainer.setAttribute("scale", "1 1 1");
      
      // Store banner state
      bannerContainer.bannerData = data;
      bannerContainer.isExpanded = false;

      // Create background plane (black and slightly transparent)
      const backgroundEl = document.createElement("a-plane");
      backgroundEl.setAttribute("width", this.data.width + 0.05);
      backgroundEl.setAttribute("height", this.data.height + 0.05);
      backgroundEl.setAttribute("position", "0 0 -0.01");
      backgroundEl.setAttribute("material", "color: #000000; transparent: true; opacity: 0.7");

      // Create the banner image plane
      const imageEl = document.createElement("a-plane");
      imageEl.setAttribute("width", this.data.width);
      imageEl.setAttribute("height", this.data.height);
      imageEl.setAttribute("position", "0 0 0");
      imageEl.setAttribute("material", `src: ${data.image}; transparent: true; alphaTest: 0.5`);
      imageEl.classList.add("banner-image");

      // Create title text (hidden initially)
      const titleEl = document.createElement("a-entity");
      titleEl.setAttribute("text", {
        value: data.title,
        align: "center",
        anchor: "center",
        width: 1.5,
        color: "#ffffff",
        fontSize: 32,
        wrapCount: 20
      });
      titleEl.setAttribute("position", "0 0.2 0.01");
      titleEl.setAttribute("visible", "false");
      titleEl.classList.add("banner-title");

      // Create description text (hidden initially)
      const descEl = document.createElement("a-entity");
      descEl.setAttribute("text", {
        value: data.description,
        align: "center",
        anchor: "center",
        width: 1.5,
        color: "#cccccc",
        fontSize: 24,
        wrapCount: 20
      });
      descEl.setAttribute("position", "0 -0.1 0.01");
      descEl.setAttribute("visible", "false");
      descEl.classList.add("banner-description");

      bannerContainer.appendChild(backgroundEl);
      bannerContainer.appendChild(imageEl);
      bannerContainer.appendChild(titleEl);
      bannerContainer.appendChild(descEl);
      
      // Make background clickable for raycaster
      backgroundEl.setAttribute("class", "banner-clickable");
      
      // Add click listener to expand/collapse
      const clickHandler = () => {
        this.toggleBannerExpand(bannerContainer);
      };
      
      bannerContainer.addEventListener("click", clickHandler);
      backgroundEl.addEventListener("click", clickHandler);
      imageEl.addEventListener("click", clickHandler);
      
      if (this.camera) {
        this.camera.appendChild(bannerContainer);
      } else {
        document.querySelector("a-scene").appendChild(bannerContainer);
      }

      this.banners.push(bannerContainer);
    });
  },

  toggleBannerExpand(banner) {
    // Close previously expanded banner
    if (this.expandedBanner && this.expandedBanner !== banner) {
      this.collapseBanner(this.expandedBanner);
    }

    if (banner.isExpanded) {
      this.collapseBanner(banner);
    } else {
      this.expandBanner(banner);
    }
  },

  expandBanner(banner) {
    banner.isExpanded = true;
    this.expandedBanner = banner;
    
    // Scale up animation - 4x bigger for clear visual feedback
    banner.setAttribute("animation", {
      property: "scale",
      to: "4 4 1",
      dur: 500,
      easing: "easeOutQuad"
    });

    // Show text elements
    const titleEl = banner.querySelector(".banner-title");
    const descEl = banner.querySelector(".banner-description");
    if (titleEl) titleEl.setAttribute("visible", "true");
    if (descEl) descEl.setAttribute("visible", "true");
  },

  collapseBanner(banner) {
    banner.isExpanded = false;
    if (this.expandedBanner === banner) {
      this.expandedBanner = null;
    }
    
    // Scale down animation
    banner.setAttribute("animation", {
      property: "scale",
      to: "1 1 1",
      dur: 500,
      easing: "easeOutQuad"
    });

    // Hide text elements
    const titleEl = banner.querySelector(".banner-title");
    const descEl = banner.querySelector(".banner-description");
    if (titleEl) titleEl.setAttribute("visible", "false");
    if (descEl) descEl.setAttribute("visible", "false");
  }
});
