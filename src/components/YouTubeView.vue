<template>
  <div class="youtube-view-container select-none">
    <!-- Browser Navigation & Control Bar -->
    <div class="browser-navbar">
      <div class="nav-buttons">
        <button class="nav-btn menu"
                :disabled="!canGoBack"
                @click="goBack"
                title="Back">
          <svg class="w-4 h-4"
               viewBox="0 0 24 24"
               fill="none"
               stroke="currentColor"
               stroke-width="2.5">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <button class="nav-btn menu"
                :disabled="!canGoForward"
                @click="goForward"
                title="Forward">
          <svg class="w-4 h-4"
               viewBox="0 0 24 24"
               fill="none"
               stroke="currentColor"
               stroke-width="2.5">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
        <button class="nav-btn menu"
                @click="reloadPage"
                :title="isLoading ? 'Stop' : 'Reload'">
          <svg v-if="!isLoading"
               class="w-4 h-4"
               viewBox="0 0 24 24"
               fill="none"
               stroke="currentColor"
               stroke-width="2">
            <path d="M23 4v6h-6"></path>
            <path d="M1 20v-6h6"></path>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          <svg v-else
               class="w-4 h-4 animate-spin"
               viewBox="0 0 24 24"
               fill="none"
               stroke="currentColor"
               stroke-width="2">
            <line x1="12"
                  y1="2"
                  x2="12"
                  y2="6"></line>
            <line x1="12"
                  y1="18"
                  x2="12"
                  y2="22"></line>
            <line x1="4.93"
                  y1="4.93"
                  x2="7.76"
                  y2="7.76"></line>
            <line x1="16.24"
                  y1="16.24"
                  x2="19.07"
                  y2="19.07"></line>
            <line x1="2"
                  y1="12"
                  x2="6"
                  y2="12"></line>
            <line x1="18"
                  y1="12"
                  x2="22"
                  y2="12"></line>
            <line x1="4.93"
                  y1="19.07"
                  x2="7.76"
                  y2="16.24"></line>
            <line x1="16.24"
                  y1="7.76"
                  x2="19.07"
                  y2="4.93"></line>
          </svg>
        </button>
        <button class="nav-btn menu"
                @click="goHome"
                title="YouTube Home">
          <svg class="w-4 h-4"
               viewBox="0 0 24 24"
               fill="none"
               stroke="currentColor"
               stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        </button>
      </div>

      <!-- Address / Search Bar -->
      <div class="address-bar-wrapper"
           @contextmenu.prevent.stop="openAddressContextMenu($event)">
        <svg class="w-4 h-4 search-icon text-zinc-400"
             viewBox="0 0 24 24"
             fill="none"
             stroke="currentColor"
             stroke-width="2">
          <circle cx="11"
                  cy="11"
                  r="8"></circle>
          <line x1="21"
                y1="21"
                x2="16.65"
                y2="16.65"></line>
        </svg>
        <input ref="addressInputRef"
               type="text"
               class="address-input"
               v-model="inputUrl"
               @keydown.enter="handleNavigate"
               @focus="focusAddressBar"
               @keydown.escape="handleAddressBarEscape"
               @contextmenu.prevent.stop="openAddressContextMenu($event)"
               placeholder="Search YouTube or paste video / audio URL (Enter to go)..." />
        <button v-if="inputUrl"
                class="clear-input-btn"
                @click="inputUrl = ''"
                title="Clear">
          ✕
        </button>
        <div class="address-actions-group">
          <button type="button"
                  class="paste-btn"
                  @click="pasteFromClipboard"
                  title="Paste from clipboard">
            Paste
          </button>
          <button ref="overflowBtnRef"
                  type="button"
                  class="overflow-btn"
                  :class="{ 'is-active': activeMenu === 'address-overflow' }"
                  @click.stop="toggleAddressOverflowMenu($event)"
                  title="More options">
            <svg class="overflow-icon"
                 viewBox="0 0 24 24"
                 fill="currentColor">
              <circle cx="12"
                      cy="5"
                      r="1.75" />
              <circle cx="12"
                      cy="12"
                      r="1.75" />
              <circle cx="12"
                      cy="19"
                      r="1.75" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content Area: Webview and Expandable Bottom Bar/Panel -->
    <div class="youtube-main-content"
         @contextmenu="handleMainContentDomContextMenu($event)">
      <!-- Find in Page Floating Bar -->
      <FindInPageBar v-if="isFindBarOpen"
                     ref="findBarRef"
                     :webview="webviewRef"
                     :initial-query="findInitialQuery"
                     @close="closeFindBar" />

      <!-- Webview Container -->
      <div class="webview-wrapper"
           :class="{ 'has-dock-bar': isVideoPage && activeVideoTitle, 'is-covered': isDrawerOpen }">
        <webview ref="webviewRef"
                 src="https://www.youtube.com"
                 class="youtube-webview"
                 allowpopups
                 partition="persist:youtube"></webview>
      </div>

      <!-- Expandable Bar and Panel Section (Unified Slide-Up Card) -->
      <div v-if="isVideoPage && activeVideoTitle"
           class="clip-dock-panel"
           :class="{ 'is-expanded': isDrawerOpen }">
        <!-- Active Video Banner / Bar (Card Header: translates from bottom to top) -->
        <div class="video-info-strip">
          <span class="live-dot"></span>
          <span class="video-title-text"
                :title="activeVideoTitle">
            {{ activeVideoTitle }}
          </span>

          <!-- Right Action: Single button that seamlessly morphs between Configure/Add Sound and Collapse -->
          <button type="button"
                  class="clip-action-btn"
                  :class="{
                    'is-collapse': isDrawerOpen,
                    'is-active': !isDrawerOpen && !isLoadingAudio,
                    'is-loading': !isDrawerOpen && isLoadingAudio,
                    'has-ready': !isDrawerOpen && !isLoadingAudio && !!audioBuffer,
                    'pulse': !isDrawerOpen && !isLoadingAudio
                  }"
                  @click="toggleClipDrawer"
                  :title="isDrawerOpen ? 'Collapse clip panel (Esc)' : 'Configure and clip sound'">
            <transition name="btn-morph"
                        mode="out-in">
              <!-- When Expanded: Collapse State -->
              <div v-if="isDrawerOpen"
                   key="collapse"
                   class="btn-inner collapse-content">
                <svg class="w-4 h-4"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2.5">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                <span>Collapse</span>
              </div>

              <!-- When Collapsed & Preloading Audio -->
              <div v-else-if="isLoadingAudio"
                   key="loading"
                   class="btn-inner loading-content">
                <div class="clip-preload-strip-fill"
                     :style="{ width: `${audioLoadProgress}%` }"></div>
                <div class="clip-preload-strip-content">
                  <svg class="w-3.5 h-3.5 animate-spin"
                       viewBox="0 0 24 24"
                       fill="none"
                       stroke="currentColor">
                    <circle cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                            class="opacity-25"></circle>
                    <path fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                          class="opacity-75"></path>
                  </svg>
                  <span class="clip-preload-strip-title">Preloading Audio: {{ audioLoadProgress }}%</span>
                </div>
              </div>

              <!-- When Collapsed & Ready / Normal -->
              <div v-else
                   key="configure"
                   class="btn-inner ready-content">
                <svg class="w-4 h-4"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2">
                  <circle cx="6"
                          cy="6"
                          r="3"></circle>
                  <circle cx="6"
                          cy="18"
                          r="3"></circle>
                  <line x1="20"
                        y1="4"
                        x2="8.12"
                        y2="15.88"></line>
                  <line x1="14.47"
                        y1="14.48"
                        x2="20"
                        y2="20"></line>
                  <line x1="8.12"
                        y1="8.12"
                        x2="12"
                        y2="12"></line>
                </svg>
                <span>Configure & Add Sound</span>
                <span v-if="audioBuffer"
                      class="ready-badge">✓ Ready</span>
              </div>
            </transition>
          </button>
        </div>

        <!-- Revealed Component: YouTubeClipPanel (Card Body + Footer) -->
        <div class="clip-component-wrapper"
             :inert="!isDrawerOpen">
          <YouTubeClipPanel ref="clipPanelRef"
                            :audio-buffer="audioBuffer"
                            :audio-duration="audioDuration"
                            :video-total-duration="videoTotalDuration"
                            :is-loading-audio="isLoadingAudio"
                            :audio-load-status="audioLoadStatus"
                            :audio-load-progress="audioLoadProgress"
                            :audio-load-error="audioLoadError"
                            :thumbnail-url="thumbnailUrl"
                            :is-short-video="isShortVideo"
                            :video-duration-formatted="videoDurationFormatted"
                            :is-capturing-frame="isCapturingFrame"
                            :active-video-title="activeVideoTitle"
                            :current-url="currentUrl"
                            :is-open="isDrawerOpen"
                            @capture-frame="handleCaptureCurrentFrame"
                            @retry-audio="loadAudioForWaveform"
                            @close="closeClipDrawer" />
        </div>
      </div>
    </div>

    <!-- Context Menu Portal -->
    <teleport to="body">
      <!-- Backdrop for closing on outside click / right-click -->
      <div v-if="activeMenu"
           class="pulse-context-backdrop"
           @mousedown="closeContextMenu"
           @contextmenu.prevent="closeContextMenu"
           @wheel="closeContextMenu"></div>

      <!-- Context Menu Popup -->
      <transition name="context-menu-fade">
        <div v-if="activeMenu"
             ref="contextMenuRef"
             class="pulse-context-menu"
             :style="{ top: `${menuPosition.y}px`, left: `${menuPosition.x}px` }"
             @contextmenu.prevent.stop>

          <!-- ADDRESS BAR CONTEXT MENU -->
          <template v-if="activeMenu === 'address'">
            <div class="menu-section-header">Address Bar</div>

            <button type="button"
                    class="context-menu-item"
                    :disabled="!inputUrl"
                    @click="handleAddressCut">
              <svg class="item-icon"
                   viewBox="0 0 24 24"
                   fill="none"
                   stroke="currentColor"
                   stroke-width="2">
                <circle cx="6"
                        cy="6"
                        r="3"></circle>
                <circle cx="6"
                        cy="18"
                        r="3"></circle>
                <line x1="20"
                      y1="4"
                      x2="8.12"
                      y2="15.88"></line>
                <line x1="14.47"
                      y1="14.48"
                      x2="20"
                      y2="20"></line>
                <line x1="8.12"
                      y1="8.12"
                      x2="12"
                      y2="12"></line>
              </svg>
              <span>Cut</span>
              <span class="item-shortcut">Ctrl+X</span>
            </button>

            <button type="button"
                    class="context-menu-item"
                    :disabled="!inputUrl"
                    @click="handleAddressCopy">
              <svg class="item-icon"
                   viewBox="0 0 24 24"
                   fill="none"
                   stroke="currentColor"
                   stroke-width="2">
                <rect x="9"
                      y="9"
                      width="13"
                      height="13"
                      rx="2"
                      ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>Copy</span>
              <span class="item-shortcut">Ctrl+C</span>
            </button>

            <button type="button"
                    class="context-menu-item"
                    :disabled="!clipboardHasText"
                    @click="handleAddressPaste">
              <svg class="item-icon"
                   viewBox="0 0 24 24"
                   fill="none"
                   stroke="currentColor"
                   stroke-width="2">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8"
                      y="2"
                      width="8"
                      height="4"
                      rx="1"
                      ry="1"></rect>
              </svg>
              <span>Paste</span>
              <span v-if="clipboardIsAddress"
                    class="item-badge">Address</span>
              <span class="item-shortcut">Ctrl+V</span>
            </button>

            <button type="button"
                    class="context-menu-item"
                    :disabled="!clipboardHasText"
                    @click="handleAddressPasteAndGo">
              <svg class="item-icon text-emerald-400"
                   viewBox="0 0 24 24"
                   fill="none"
                   stroke="currentColor"
                   stroke-width="2">
                <path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z"></path>
                <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"></path>
                <path d="m13 14 3-3-3-3"></path>
                <path d="M9 11h7"></path>
              </svg>
              <span>{{ clipboardIsAddress ? 'Paste & Go' : 'Paste & Search' }}</span>
              <span class="item-shortcut">↵</span>
            </button>

            <div class="menu-divider"></div>

            <button type="button"
                    class="context-menu-item"
                    :disabled="!inputUrl"
                    @click="handleAddressSelectAll">
              <svg class="item-icon"
                   viewBox="0 0 24 24"
                   fill="none"
                   stroke="currentColor"
                   stroke-width="2">
                <path d="M3 3h4"></path>
                <path d="M17 3h4"></path>
                <path d="M3 21h4"></path>
                <path d="M17 21h4"></path>
                <path d="M3 7v10"></path>
                <path d="M21 7v10"></path>
                <rect x="8"
                      y="8"
                      width="8"
                      height="8"
                      rx="1"></rect>
              </svg>
              <span>Select All</span>
              <span class="item-shortcut">Ctrl+A</span>
            </button>

            <button type="button"
                    class="context-menu-item"
                    :disabled="!inputUrl"
                    @click="handleAddressClear">
              <svg class="item-icon"
                   viewBox="0 0 24 24"
                   fill="none"
                   stroke="currentColor"
                   stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              <span>Clear</span>
            </button>
          </template>

          <!-- MAIN CONTENT / WEBVIEW CONTEXT MENU -->
          <template v-else-if="activeMenu === 'webview'">
            <!-- Link Context Group -->
            <template v-if="webviewMenuContext.linkUrl">
              <div class="menu-preview-header"
                   :title="webviewMenuContext.linkUrl">
                <svg class="w-3.5 h-3.5 text-emerald-400 shrink-0"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
                <span class="truncate">{{ truncateUrl(webviewMenuContext.linkUrl) }}</span>
              </div>

              <button type="button"
                      class="context-menu-item"
                      @click="handleOpenLink">
                <svg class="item-icon"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10"
                        y1="14"
                        x2="21"
                        y2="3"></line>
                </svg>
                <span>Open Link</span>
              </button>

              <button type="button"
                      class="context-menu-item"
                      @click="handleOpenLinkInNewWindow">
                <svg class="item-icon"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2">
                  <rect x="2"
                        y="3"
                        width="20"
                        height="14"
                        rx="2"
                        ry="2"></rect>
                  <line x1="8"
                        y1="21"
                        x2="16"
                        y2="21"></line>
                  <line x1="12"
                        y1="17"
                        x2="12"
                        y2="21"></line>
                </svg>
                <span>Open Link in New Window</span>
              </button>

              <button type="button"
                      class="context-menu-item"
                      @click="handleCopyLinkAddress">
                <svg class="item-icon"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
                <span>Copy Link Address</span>
              </button>

              <div class="menu-divider"></div>
            </template>

            <!-- Selection Context Group -->
            <template v-if="webviewMenuContext.selectionText">
              <button type="button"
                      class="context-menu-item"
                      @click="handleCopySelectionText">
                <svg class="item-icon"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2">
                  <rect x="9"
                        y="9"
                        width="13"
                        height="13"
                        rx="2"
                        ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>Copy Text</span>
                <span class="item-shortcut">Ctrl+C</span>
              </button>

              <button type="button"
                      class="context-menu-item"
                      @click="handleSearchSelection">
                <svg class="item-icon"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2">
                  <circle cx="11"
                          cy="11"
                          r="8"></circle>
                  <line x1="21"
                        y1="21"
                        x2="16.65"
                        y2="16.65"></line>
                </svg>
                <span class="truncate">Search YouTube for "{{ webviewMenuContext.selectionText.slice(0, 18) }}..."</span>
              </button>

              <div class="menu-divider"></div>
            </template>

            <!-- Editable Fields inside Guest Page -->
            <template v-else-if="webviewMenuContext.isEditable">
              <button type="button"
                      class="context-menu-item"
                      :disabled="!webviewMenuContext.canCut"
                      @click="handleWebviewCut">
                <svg class="item-icon"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2">
                  <circle cx="6"
                          cy="6"
                          r="3"></circle>
                  <circle cx="6"
                          cy="18"
                          r="3"></circle>
                  <line x1="20"
                        y1="4"
                        x2="8.12"
                        y2="15.88"></line>
                  <line x1="14.47"
                        y1="14.48"
                        x2="20"
                        y2="20"></line>
                  <line x1="8.12"
                        y1="8.12"
                        x2="12"
                        y2="12"></line>
                </svg>
                <span>Cut</span>
                <span class="item-shortcut">Ctrl+X</span>
              </button>

              <button type="button"
                      class="context-menu-item"
                      :disabled="!webviewMenuContext.canCopy"
                      @click="handleCopySelectionText">
                <svg class="item-icon"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2">
                  <rect x="9"
                        y="9"
                        width="13"
                        height="13"
                        rx="2"
                        ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>Copy</span>
                <span class="item-shortcut">Ctrl+C</span>
              </button>

              <button type="button"
                      class="context-menu-item"
                      :disabled="!webviewMenuContext.canPaste && !clipboardHasText"
                      @click="handleWebviewPaste">
                <svg class="item-icon"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                  <rect x="8"
                        y="2"
                        width="8"
                        height="4"
                        rx="1"
                        ry="1"></rect>
                </svg>
                <span>Paste</span>
                <span class="item-shortcut">Ctrl+V</span>
              </button>

              <button type="button"
                      class="context-menu-item"
                      @click="handleWebviewSelectAll">
                <svg class="item-icon"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2">
                  <path d="M3 3h4"></path>
                  <path d="M17 3h4"></path>
                  <path d="M3 21h4"></path>
                  <path d="M17 21h4"></path>
                  <path d="M3 7v10"></path>
                  <path d="M21 7v10"></path>
                  <rect x="8"
                        y="8"
                        width="8"
                        height="8"
                        rx="1"></rect>
                </svg>
                <span>Select All</span>
                <span class="item-shortcut">Ctrl+A</span>
              </button>

              <div class="menu-divider"></div>
            </template>

            <!-- Audio Media Actions (Detected Audio Element) -->
            <template v-if="webviewMenuContext.isAudio && webviewMenuContext.audioSrc">
              <div v-if="webviewMenuContext.audioTitle" class="menu-preview-header">
                <svg class="item-icon text-emerald-400"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2">
                  <path d="M9 18V5l12-2v13"></path>
                  <circle cx="6" cy="18" r="3"></circle>
                  <circle cx="18" cy="16" r="3"></circle>
                </svg>
                <span class="truncate">{{ webviewMenuContext.audioTitle }}</span>
              </div>

              <button type="button"
                      class="context-menu-item audio-highlight-item"
                      @click="handleClipAudioFromPage">
                <svg class="item-icon"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2.5">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
                <span>Add Sound to Pulse Panel</span>
                <span class="item-badge">Clip</span>
              </button>

              <button type="button"
                      class="context-menu-item"
                      @click="handleCopyAudioAddress">
                <svg class="item-icon"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
                <span>Copy Audio URL</span>
              </button>

              <button type="button"
                      class="context-menu-item"
                      @click="handleOpenAudioInNewWindow">
                <svg class="item-icon"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="8" y1="21" x2="16" y2="21"></line>
                  <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
                <span>Open Audio in New Window</span>
              </button>

              <div class="menu-divider"></div>
            </template>

            <!-- Image Media Actions -->
            <template v-if="webviewMenuContext.srcUrl && (webviewMenuContext.mediaType === 'image' || webviewMenuContext.srcUrl.includes('ytimg') || webviewMenuContext.srcUrl.includes('googleusercontent'))">
              <button type="button"
                      class="context-menu-item"
                      @click="handleCopyImageAddress">
                <svg class="item-icon"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2">
                  <rect x="3"
                        y="3"
                        width="18"
                        height="18"
                        rx="2"
                        ry="2"></rect>
                  <circle cx="8.5"
                          cy="8.5"
                          r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                <span>Copy Image Address</span>
              </button>

              <button type="button"
                      class="context-menu-item"
                      @click="handleOpenImageInNewWindow">
                <svg class="item-icon"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2">
                  <rect x="2"
                        y="3"
                        width="20"
                        height="14"
                        rx="2"
                        ry="2"></rect>
                  <line x1="8"
                        y1="21"
                        x2="16"
                        y2="21"></line>
                  <line x1="12"
                        y1="17"
                        x2="12"
                        y2="21"></line>
                </svg>
                <span>Open Image in New Window</span>
              </button>

              <div class="menu-divider"></div>
            </template>

            <!-- Navigation Controls (Always present and prominent!) -->
            <button type="button"
                    class="context-menu-item"
                    :disabled="!canGoBack"
                    @click="handleMenuBack">
              <svg class="item-icon"
                   viewBox="0 0 24 24"
                   fill="none"
                   stroke="currentColor"
                   stroke-width="2.5">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              <span>Back</span>
              <span class="item-shortcut">Alt+Left</span>
            </button>

            <button type="button"
                    class="context-menu-item"
                    :disabled="!canGoForward"
                    @click="handleMenuForward">
              <svg class="item-icon"
                   viewBox="0 0 24 24"
                   fill="none"
                   stroke="currentColor"
                   stroke-width="2.5">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
              <span>Forward</span>
              <span class="item-shortcut">Alt+Right</span>
            </button>

            <button type="button"
                    class="context-menu-item"
                    @click="handleMenuReload">
              <svg class="item-icon"
                   viewBox="0 0 24 24"
                   fill="none"
                   stroke="currentColor"
                   stroke-width="2">
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              <span>{{ isLoading ? 'Stop' : 'Reload' }}</span>
              <span class="item-shortcut">Ctrl+R</span>
            </button>

            <div class="menu-divider"></div>

            <!-- Page Level Actions -->
            <button type="button"
                    class="context-menu-item"
                    @click="handleMenuFindInPage">
              <svg class="item-icon text-blue-400"
                   viewBox="0 0 24 24"
                   fill="none"
                   stroke="currentColor"
                   stroke-width="2">
                <circle cx="11"
                        cy="11"
                        r="8"></circle>
                <line x1="21"
                      y1="21"
                      x2="16.65"
                      y2="16.65"></line>
              </svg>
              <span>Find in Page</span>
              <span class="item-shortcut">Ctrl+F</span>
            </button>

            <button type="button"
                    class="context-menu-item"
                    @click="handleCopyPageUrl">
              <svg class="item-icon"
                   viewBox="0 0 24 24"
                   fill="none"
                   stroke="currentColor"
                   stroke-width="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
              <span>Copy Page URL</span>
            </button>

            <button v-if="isVideoPage"
                    type="button"
                    class="context-menu-item"
                    @click="handleCopyTimestampedVideoUrl">
              <svg class="item-icon text-amber-400"
                   viewBox="0 0 24 24"
                   fill="none"
                   stroke="currentColor"
                   stroke-width="2">
                <circle cx="12"
                        cy="12"
                        r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>Copy Video URL at {{ formatTime(currentVideoTime) }}</span>
            </button>

            <button type="button"
                    class="context-menu-item"
                    @click="handleOpenPageInNewWindow">
              <svg class="item-icon"
                   viewBox="0 0 24 24"
                   fill="none"
                   stroke="currentColor"
                   stroke-width="2">
                <rect x="2"
                      y="3"
                      width="20"
                      height="14"
                      rx="2"
                      ry="2"></rect>
                <line x1="8"
                      y1="21"
                      x2="16"
                      y2="21"></line>
                <line x1="12"
                      y1="17"
                      x2="12"
                      y2="21"></line>
              </svg>
              <span>Open Page in New Window</span>
            </button>
          </template>

          <!-- ADDRESS OVERFLOW CONTEXT MENU -->
          <template v-else-if="activeMenu === 'address-overflow'">
            <div class="menu-section-header">Options</div>

            <button type="button"
                    class="context-menu-item"
                    @click="handleMenuFindInPage">
              <svg class="item-icon text-blue-400"
                   viewBox="0 0 24 24"
                   fill="none"
                   stroke="currentColor"
                   stroke-width="2">
                <circle cx="11"
                        cy="11"
                        r="8"></circle>
                <line x1="21"
                      y1="21"
                      x2="16.65"
                      y2="16.65"></line>
              </svg>
              <span>Find in Page</span>
              <span class="item-shortcut">Ctrl+F</span>
            </button>

            <div class="menu-divider"></div>

            <button type="button"
                    class="context-menu-item"
                    @click="handleMenuReload">
              <svg class="item-icon"
                   viewBox="0 0 24 24"
                   fill="none"
                   stroke="currentColor"
                   stroke-width="2">
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              <span>Reload</span>
              <span class="item-shortcut">Ctrl+R</span>
            </button>

            <button type="button"
                    class="context-menu-item"
                    @click="handleCopyPageUrl">
              <svg class="item-icon"
                   viewBox="0 0 24 24"
                   fill="none"
                   stroke="currentColor"
                   stroke-width="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
              <span>Copy Page URL</span>
            </button>

            <button type="button"
                    class="context-menu-item"
                    @click="handleOpenPageInNewWindow">
              <svg class="item-icon"
                   viewBox="0 0 24 24"
                   fill="none"
                   stroke="currentColor"
                   stroke-width="2">
                <rect x="2"
                      y="3"
                      width="20"
                      height="14"
                      rx="2"
                      ry="2"></rect>
                <line x1="8"
                      y1="21"
                      x2="16"
                      y2="21"></line>
                <line x1="12"
                      y1="17"
                      x2="12"
                      y2="21"></line>
              </svg>
              <span>Open in External Browser</span>
            </button>
          </template>

        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import YouTubeClipPanel from './YouTubeClipPanel.vue';
import FindInPageBar from './FindInPageBar.vue';
import { usePulseBackStore } from '../store/pulseBack';

const props = withDefaults(
  defineProps<{
    active?: boolean;
  }>(),
  {
    active: true,
  }
);

const route = useRoute();
const pulseBackStore = usePulseBackStore();

const webviewRef = ref<any>(null);
const clipPanelRef = ref<any>(null);
const addressInputRef = ref<HTMLInputElement | null>(null);
const overflowBtnRef = ref<HTMLElement | null>(null);
const findBarRef = ref<any>(null);

// Find in Page state
const isFindBarOpen = ref(false);
const findInitialQuery = ref('');
const isViewActive = ref(true);

// Context menu state
type MenuType = 'address' | 'webview' | 'address-overflow' | null;

interface MenuPosition {
  x: number;
  y: number;
}

interface WebviewMenuContext {
  linkUrl: string;
  linkText: string;
  selectionText: string;
  srcUrl: string;
  mediaType: string;
  isAudio?: boolean;
  audioSrc?: string;
  audioTitle?: string;
  audioDuration?: number;
  isEditable: boolean;
  canCut: boolean;
  canCopy: boolean;
  canPaste: boolean;
  canSelectAll: boolean;
}

const activeMenu = ref<MenuType>(null);
const menuPosition = ref<MenuPosition>({ x: 0, y: 0 });
const contextMenuRef = ref<HTMLElement | null>(null);

const clipboardText = ref('');
const clipboardHasText = ref(false);
const clipboardIsAddress = ref(false);

const addressSelection = ref({
  start: 0,
  end: 0,
  hasSelection: false,
  selectedText: '',
});

const webviewMenuContext = ref<WebviewMenuContext>({
  linkUrl: '',
  linkText: '',
  selectionText: '',
  srcUrl: '',
  mediaType: 'none',
  isAudio: false,
  audioSrc: '',
  audioTitle: '',
  audioDuration: 0,
  isEditable: false,
  canCut: false,
  canCopy: false,
  canPaste: false,
  canSelectAll: false,
});

let lastMousePos = { x: 100, y: 100 };
function updateMousePos(e: MouseEvent) {
  lastMousePos = { x: e.clientX, y: e.clientY };
}

function isLikelyAddress(str: string): boolean {
  if (!str) return false;
  const s = str.trim();
  if (/^(https?:\/\/|www\.)/i.test(s)) return true;
  if (s.includes('youtube.com') || s.includes('youtu.be')) return true;
  if (!s.includes(' ') && /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(s)) return true;
  return false;
}

function truncateUrl(url: string, maxLen = 34): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const display = parsed.hostname.replace(/^www\./, '') + parsed.pathname + (parsed.search ? parsed.search : '');
    return display.length > maxLen ? display.substring(0, maxLen - 1) + '…' : display;
  } catch (_) {
    return url.length > maxLen ? url.substring(0, maxLen - 1) + '…' : url;
  }
}

async function refreshClipboardState() {
  try {
    const text = (await navigator.clipboard.readText()) || '';
    const trimmed = text.trim();
    clipboardText.value = trimmed;
    clipboardHasText.value = trimmed.length > 0;
    clipboardIsAddress.value = isLikelyAddress(trimmed);
  } catch (_) {
    clipboardText.value = '';
    clipboardHasText.value = false;
    clipboardIsAddress.value = false;
  }
}

async function showMenuAt(type: MenuType, x: number, y: number) {
  activeMenu.value = type;
  menuPosition.value = { x, y };

  await nextTick();
  if (contextMenuRef.value) {
    const rect = contextMenuRef.value.getBoundingClientRect();
    const menuWidth = rect.width || 220;
    const menuHeight = rect.height || 260;
    const padding = 10;
    let finalX = x;
    let finalY = y;

    if (finalX + menuWidth > window.innerWidth - padding) {
      finalX = Math.max(padding, window.innerWidth - menuWidth - padding);
    }
    if (finalY + menuHeight > window.innerHeight - padding) {
      finalY = Math.max(padding, window.innerHeight - menuHeight - padding);
    }
    menuPosition.value = { x: Math.max(padding, finalX), y: Math.max(padding, finalY) };
  }
}

function closeContextMenu() {
  activeMenu.value = null;
}

// Address Bar Context Menu
async function openAddressContextMenu(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();

  await refreshClipboardState();

  const inputEl = addressInputRef.value;
  if (inputEl) {
    const start = inputEl.selectionStart ?? 0;
    const end = inputEl.selectionEnd ?? 0;
    const val = inputEl.value;
    const hasSelection = start !== end && start >= 0 && end <= val.length;
    const selectedText = hasSelection ? val.substring(start, end) : '';

    addressSelection.value = {
      start,
      end,
      hasSelection,
      selectedText,
    };
  } else {
    addressSelection.value = {
      start: 0,
      end: 0,
      hasSelection: false,
      selectedText: '',
    };
  }

  await showMenuAt('address', event.clientX, event.clientY);
}

async function handleAddressCut() {
  closeContextMenu();
  const inputEl = addressInputRef.value;
  const current = inputUrl.value;
  if (!current) return;

  let textToCut = current;
  if (addressSelection.value.hasSelection && addressSelection.value.selectedText) {
    textToCut = addressSelection.value.selectedText;
    const { start, end } = addressSelection.value;
    inputUrl.value = current.substring(0, start) + current.substring(end);
    nextTick(() => {
      inputEl?.focus();
      inputEl?.setSelectionRange(start, start);
    });
  } else {
    inputUrl.value = '';
    nextTick(() => {
      inputEl?.focus();
    });
  }

  try {
    await navigator.clipboard.writeText(textToCut);
    pulseBackStore.showToast('Cut to clipboard');
  } catch (_) { }
}

async function handleAddressCopy() {
  closeContextMenu();
  const current = inputUrl.value;
  if (!current) return;

  const textToCopy = addressSelection.value.hasSelection && addressSelection.value.selectedText
    ? addressSelection.value.selectedText
    : current;

  try {
    await navigator.clipboard.writeText(textToCopy);
    pulseBackStore.showToast('Copied to clipboard');
  } catch (_) { }
}

async function handleAddressPaste() {
  closeContextMenu();
  if (!clipboardHasText.value || !clipboardText.value) return;

  const pasteVal = clipboardText.value;
  const inputEl = addressInputRef.value;
  const current = inputUrl.value;

  if (addressSelection.value.hasSelection) {
    const { start, end } = addressSelection.value;
    inputUrl.value = current.substring(0, start) + pasteVal + current.substring(end);
    const newPos = start + pasteVal.length;
    nextTick(() => {
      inputEl?.focus();
      inputEl?.setSelectionRange(newPos, newPos);
    });
  } else {
    inputUrl.value = pasteVal;
    nextTick(() => {
      inputEl?.focus();
      inputEl?.select();
    });
  }

  pulseBackStore.showToast('Pasted from clipboard');
}

async function handleAddressPasteAndGo() {
  closeContextMenu();
  if (!clipboardHasText.value || !clipboardText.value) return;

  inputUrl.value = clipboardText.value;
  handleNavigate();
  pulseBackStore.showToast(clipboardIsAddress.value ? 'Navigating to address...' : 'Searching YouTube...');
}

function handleAddressSelectAll() {
  closeContextMenu();
  nextTick(() => {
    addressInputRef.value?.focus();
    addressInputRef.value?.select();
  });
}

function handleAddressClear() {
  closeContextMenu();
  inputUrl.value = '';
  nextTick(() => {
    addressInputRef.value?.focus();
  });
}

// Main Content / Webview Context Menu
function openMainContextMenu(params: {
  x: number;
  y: number;
  linkUrl?: string;
  linkText?: string;
  selectionText?: string;
  srcUrl?: string;
  mediaType?: string;
  isAudio?: boolean;
  audioSrc?: string;
  audioTitle?: string;
  audioDuration?: number;
  isEditable?: boolean;
  editFlags?: any;
}) {
  let linkUrl = params.linkUrl || '';
  if (linkUrl && linkUrl.startsWith('/')) {
    try {
      linkUrl = new URL(linkUrl, 'https://www.youtube.com').href;
    } catch (_) { }
  }

  const editFlags = params.editFlags || {};
  webviewMenuContext.value = {
    linkUrl,
    linkText: params.linkText || '',
    selectionText: params.selectionText || '',
    srcUrl: params.srcUrl || '',
    mediaType: params.mediaType || 'none',
    isAudio: !!params.isAudio,
    audioSrc: params.audioSrc || '',
    audioTitle: params.audioTitle || '',
    audioDuration: params.audioDuration || 0,
    isEditable: !!params.isEditable,
    canCut: !!editFlags.canCut,
    canCopy: !!editFlags.canCopy || !!params.selectionText,
    canPaste: !!editFlags.canPaste || clipboardHasText.value,
    canSelectAll: !!editFlags.canSelectAll,
  };

  showMenuAt('webview', params.x, params.y);
}

async function handleWebviewContextMenu(event: any) {
  event?.preventDefault?.();
  await refreshClipboardState();

  const wv = webviewRef.value;
  const params = event.params || event || {};
  const rect = wv?.getBoundingClientRect();

  const rawX = rect ? rect.left + (typeof params.x === 'number' ? params.x : 20) : lastMousePos.x;
  const rawY = rect ? rect.top + (typeof params.y === 'number' ? params.y : 20) : lastMousePos.y;

  let detectedAudio: { src: string; title: string; duration: number } | null = null;
  if (wv && typeof params.x === 'number' && typeof params.y === 'number') {
    try {
      const detectScript = `
        (() => {
          try {
            const x = ${params.x};
            const y = ${params.y};
            const knownSrc = ${JSON.stringify(params.srcURL || '')};

            const allAudios = Array.from(document.querySelectorAll('audio'));
            let audioEl = null;

            // 1. If Chromium already provided the exact clicked media srcURL, find that specific element
            if (knownSrc) {
              audioEl = allAudios.find(a => {
                const s = a.currentSrc || a.src || a.querySelector('source')?.src || '';
                return s === knownSrc || (s && knownSrc.includes(s)) || (s && s.includes(knownSrc));
              });
            }

            // 2. Direct hit or closest inside container (table row tr or list item li)
            if (!audioEl) {
              let el = document.elementFromPoint(x, y);
              if (el) {
                audioEl = el.closest('audio') || (el.tagName === 'AUDIO' ? el : null);
                if (!audioEl) {
                  const tr = el.closest('tr, li, .audio-row, .voice-line, .sound-row');
                  if (tr) {
                    audioEl = tr.querySelector('audio');
                  }
                }
              }
            }

            // 3. Proximity check: find the audio whose bounding rectangle is closest to (x, y)
            if (!audioEl && allAudios.length > 0) {
              let closestAudio = null;
              let minDistance = Infinity;

              for (const a of allAudios) {
                const r = a.getBoundingClientRect();
                const dx = Math.max(r.left - x, 0, x - r.right);
                const dy = Math.max(r.top - y, 0, y - r.bottom);
                const dist = Math.hypot(dx, dy);

                if (dist < minDistance) {
                  minDistance = dist;
                  closestAudio = a;
                }
              }

              // Accept only if within 120px of cursor
              if (minDistance < 120) {
                audioEl = closestAudio;
              }
            }

            // 4. Anchor tag pointing to an audio file
            if (!audioEl) {
              let el = document.elementFromPoint(x, y);
              const anchor = el?.closest('a');
              if (anchor && anchor.href && /\\.(mp3|wav|ogg|oga|m4a|aac|flac|opus)($|\\?)/i.test(anchor.href)) {
                return {
                  src: anchor.href,
                  title: anchor.textContent?.trim() || '',
                  duration: 0
                };
              }
              return null;
            }

            const src = audioEl.currentSrc || audioEl.src || audioEl.querySelector('source')?.src || knownSrc || '';
            if (!src) return null;

            // Smart title extraction from adjacent table cell, list item, or container
            let title = '';
            const tr = audioEl.closest('tr');
            if (tr) {
              const cells = Array.from(tr.querySelectorAll('td, th'));
              for (const cell of cells) {
                if (!cell.contains(audioEl) && cell.textContent?.trim()) {
                  title = cell.textContent.trim();
                  break;
                }
              }
            }
            if (!title) {
              const li = audioEl.closest('li');
              if (li) {
                const clone = li.cloneNode(true);
                clone.querySelectorAll('audio, script, style, button, svg').forEach(n => n.remove());
                title = clone.textContent?.trim() || '';
              }
            }
            if (!title) {
              const container = audioEl.closest('.audio-item, .voice-line, .sound-row, p');
              if (container) {
                const clone = container.cloneNode(true);
                clone.querySelectorAll('audio, script, style, button, svg').forEach(n => n.remove());
                title = clone.textContent?.trim() || '';
              }
            }
            if (!title && audioEl.title) title = audioEl.title;
            if (!title && audioEl.getAttribute('aria-label')) title = audioEl.getAttribute('aria-label');

            return {
              src,
              title: title.replace(/\\s+/g, ' ').slice(0, 100).trim(),
              duration: audioEl.duration || 0
            };
          } catch (_) {
            return null;
          }
        })()
      `;
      detectedAudio = await wv.executeJavaScript(detectScript);
    } catch (_) { }
  }

  const isAudioMedia = !!(
    (params.mediaType === 'audio' && params.srcURL) ||
    detectedAudio?.src ||
    (params.srcURL && isDirectMediaUrl(params.srcURL))
  );

  // If Chromium's native hit-test provided a mediaType: 'audio' srcURL, prioritize it!
  const finalAudioSrc = (params.mediaType === 'audio' && params.srcURL)
    ? params.srcURL
    : (detectedAudio?.src || (isDirectMediaUrl(params.srcURL) ? params.srcURL : ''));

  const finalAudioTitle = detectedAudio?.title || (finalAudioSrc ? extractMediaTitle(finalAudioSrc) : '');

  openMainContextMenu({
    x: rawX,
    y: rawY,
    linkUrl: params.linkURL || params.linkUrl || '',
    linkText: params.linkText || '',
    selectionText: params.selectionText || '',
    srcUrl: params.srcURL || params.srcUrl || finalAudioSrc || '',
    mediaType: isAudioMedia ? 'audio' : (params.mediaType || 'none'),
    isAudio: isAudioMedia && !!finalAudioSrc,
    audioSrc: finalAudioSrc,
    audioTitle: finalAudioTitle,
    audioDuration: detectedAudio?.duration || 0,
    isEditable: !!params.isEditable,
    editFlags: params.editFlags,
  });
}

async function handleMainContentDomContextMenu(event: MouseEvent) {
  if ((event.target as HTMLElement)?.closest?.('.clip-dock-panel')) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();

  await refreshClipboardState();

  openMainContextMenu({
    x: event.clientX,
    y: event.clientY,
    linkUrl: '',
    linkText: '',
    selectionText: window.getSelection()?.toString()?.trim() || '',
    srcUrl: '',
    mediaType: 'none',
    isEditable: false,
  });
}

function handleOpenLink() {
  closeContextMenu();
  const url = webviewMenuContext.value.linkUrl;
  if (url) {
    navigateToUrl(url);
  }
}

function handleOpenLinkInNewWindow() {
  closeContextMenu();
  const url = webviewMenuContext.value.linkUrl;
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    window.electron?.openExternalLink(url);
    pulseBackStore.showToast('Opened link in default browser');
  }
}

async function handleCopyLinkAddress() {
  closeContextMenu();
  const url = webviewMenuContext.value.linkUrl;
  if (url) {
    try {
      await navigator.clipboard.writeText(url);
      pulseBackStore.showToast('Link address copied to clipboard');
    } catch (_) { }
  }
}

async function handleCopySelectionText() {
  closeContextMenu();
  const text = webviewMenuContext.value.selectionText;
  if (text) {
    try {
      await navigator.clipboard.writeText(text);
      webviewRef.value?.copy?.();
      pulseBackStore.showToast('Text copied to clipboard');
    } catch (_) { }
  } else {
    try {
      webviewRef.value?.copy?.();
      pulseBackStore.showToast('Copied to clipboard');
    } catch (_) { }
  }
}

function handleSearchSelection() {
  closeContextMenu();
  const text = webviewMenuContext.value.selectionText;
  if (text) {
    navigateToUrl(`https://www.youtube.com/results?search_query=${encodeURIComponent(text)}`);
  }
}

function handleWebviewCut() {
  closeContextMenu();
  try {
    webviewRef.value?.cut?.();
  } catch (_) { }
}

function handleWebviewPaste() {
  closeContextMenu();
  try {
    webviewRef.value?.paste?.();
  } catch (_) { }
}

function handleWebviewSelectAll() {
  closeContextMenu();
  try {
    webviewRef.value?.selectAll?.();
  } catch (_) { }
}

function handleMenuBack() {
  closeContextMenu();
  goBack();
}

function handleMenuForward() {
  closeContextMenu();
  goForward();
}

function handleMenuReload() {
  closeContextMenu();
  reloadPage();
}

async function handleCopyPageUrl() {
  closeContextMenu();
  const url = currentUrl.value;
  if (url) {
    try {
      await navigator.clipboard.writeText(url);
      pulseBackStore.showToast('Page URL copied to clipboard');
    } catch (_) { }
  }
}

async function handleCopyTimestampedVideoUrl() {
  closeContextMenu();
  const url = currentUrl.value;
  const timeSec = Math.floor(currentVideoTime.value);
  let finalUrl = url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('t', `${timeSec}s`);
    finalUrl = parsed.toString();
  } catch (_) {
    const sep = url.includes('?') ? '&' : '?';
    finalUrl = `${url}${sep}t=${timeSec}s`;
  }
  try {
    await navigator.clipboard.writeText(finalUrl);
    pulseBackStore.showToast(`Copied video URL at ${formatTime(timeSec)}`);
  } catch (_) { }
}

function handleOpenPageInNewWindow() {
  closeContextMenu();
  const url = currentUrl.value;
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    window.electron?.openExternalLink(url);
    pulseBackStore.showToast('Opened in default browser');
  }
}

async function handleCopyImageAddress() {
  closeContextMenu();
  const url = webviewMenuContext.value.srcUrl;
  if (url) {
    try {
      await navigator.clipboard.writeText(url);
      pulseBackStore.showToast('Image address copied to clipboard');
    } catch (_) { }
  }
}

function handleOpenImageInNewWindow() {
  closeContextMenu();
  const url = webviewMenuContext.value.srcUrl;
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    window.electron?.openExternalLink(url);
    pulseBackStore.showToast('Opened image in default browser');
  }
}

// Audio Element Actions from Context Menu
async function handleClipAudioFromPage() {
  const audioSrc = webviewMenuContext.value.audioSrc || webviewMenuContext.value.srcUrl;
  const audioTitle = webviewMenuContext.value.audioTitle || extractMediaTitle(audioSrc || '');
  closeContextMenu();

  if (!audioSrc) return;

  // 1. Pause any playing media on the guest web page so it doesn't clash with editor playback
  try {
    webviewRef.value?.executeJavaScript('document.querySelectorAll("audio, video").forEach(el => el.pause())');
  } catch (_) { }

  // 2. Clear out any previous audio buffer/state so it doesn't display stale data
  currentPreloadedVideoId.value = null;
  currentAudioLoadUrl = '';
  audioBuffer.value = null;
  originalAudioBuffer.value = null;
  audioDuration.value = 0;

  // 3. Set title and flags
  activeVideoTitle.value = audioTitle;
  isVideoPage.value = true;
  if (webviewMenuContext.value.audioDuration) {
    videoTotalDuration.value = webviewMenuContext.value.audioDuration;
    videoDurationFormatted.value = formatTime(webviewMenuContext.value.audioDuration);
  } else {
    videoTotalDuration.value = null;
    videoDurationFormatted.value = '';
  }

  // 4. Open the clip drawer immediately (dock expands with smooth animation)
  isDrawerOpen.value = true;

  // 5. Load the audio into the waveform editor
  await loadAudioForWaveform(audioSrc);

  pulseBackStore.showToast(`Loaded "${audioTitle}" into sound editor`);
}

async function handleCopyAudioAddress() {
  closeContextMenu();
  const url = webviewMenuContext.value.audioSrc || webviewMenuContext.value.srcUrl;
  if (url) {
    try {
      await navigator.clipboard.writeText(url);
      pulseBackStore.showToast('Audio URL copied to clipboard');
    } catch (_) { }
  }
}

function handleOpenAudioInNewWindow() {
  closeContextMenu();
  const url = webviewMenuContext.value.audioSrc || webviewMenuContext.value.srcUrl;
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    window.electron?.openExternalLink(url);
    pulseBackStore.showToast('Opened audio in default browser');
  }
}

// Address Bar Overflow Menu & Find in Page
function toggleAddressOverflowMenu(event: MouseEvent) {
  if (activeMenu.value === 'address-overflow') {
    closeContextMenu();
    return;
  }
  const btn = (event.currentTarget as HTMLElement) || overflowBtnRef.value;
  if (btn) {
    const rect = btn.getBoundingClientRect();
    showMenuAt('address-overflow', rect.right - 215, rect.bottom + 6);
  } else {
    showMenuAt('address-overflow', event.clientX - 200, event.clientY + 10);
  }
}

function handleMenuFindInPage() {
  const initial = webviewMenuContext.value.selectionText || '';
  closeContextMenu();
  openFindBar(initial);
}

async function openFindBar(initialQuery?: string) {
  isFindBarOpen.value = true;
  if (typeof initialQuery === 'string' && initialQuery.trim()) {
    findInitialQuery.value = initialQuery.trim();
  } else {
    try {
      const selected = await webviewRef.value?.executeJavaScript('window.getSelection()?.toString() || ""');
      if (selected && selected.trim() && !selected.includes('\n') && selected.trim().length < 80) {
        findInitialQuery.value = selected.trim();
      } else {
        findInitialQuery.value = '';
      }
    } catch (_) {
      findInitialQuery.value = '';
    }
  }

  nextTick(() => {
    findBarRef.value?.focus();
  });
}

function closeFindBar() {
  isFindBarOpen.value = false;
  findInitialQuery.value = '';
  try {
    webviewRef.value?.focus();
  } catch (_) { }
}



// Navigation state
const inputUrl = ref('https://www.youtube.com');
const currentUrl = ref('https://www.youtube.com');
const canGoBack = ref(false);
const canGoForward = ref(false);
const isLoading = ref(false);

// Video state
const isVideoPage = ref(false);
const isShortVideo = ref(false);
const activeVideoTitle = ref('');
const thumbnailUrl = ref('');
const videoTotalDuration = ref<number | null>(null);
const currentVideoTime = ref(0);

// Drawer state
const isDrawerOpen = ref(false);
const isCapturingFrame = ref(false);

// Audio state (for background preloading)
const audioBuffer = shallowRef<AudioBuffer | null>(null);
const originalAudioBuffer = shallowRef<AudioBuffer | null>(null);
const audioDuration = ref(0);
const isLoadingAudio = ref(false);
const audioLoadProgress = ref(0);
const audioLoadStatus = ref('');
const audioLoadError = ref('');

let currentAudioLoadUrl = '';
const currentPreloadedVideoId = ref<string | null>(null);
let videoHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
let audioContext: AudioContext | null = null;

function formatTime(totalSeconds: number): string {
  if (Number.isNaN(totalSeconds) || totalSeconds < 0) return '0:00';
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const secsFormatted = secs % 1 === 0
    ? (secs < 10 ? `0${secs}` : `${secs}`)
    : (secs < 10 ? `0${secs.toFixed(1)}` : secs.toFixed(1));
  return `${mins}:${secsFormatted}`;
}

const videoDurationFormatted = ref('');

function isDirectMediaUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    return /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|webm|weba|wma|aiff|aif|mp4)$/i.test(pathname);
  } catch {
    return false;
  }
}

function extractMediaTitle(url: string): string {
  try {
    const parsed = new URL(url);
    const filename = parsed.pathname.split('/').filter(Boolean).pop() || '';
    const nameWithoutExt = filename.replace(/\.[a-zA-Z0-9]+$/, '');
    return decodeURIComponent(nameWithoutExt).replace(/[-_]+/g, ' ').trim() || decodeURIComponent(filename) || 'Audio Track';
  } catch {
    return 'Audio Track';
  }
}

function getVideoId(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be')) {
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v');
      }
      const shortsMatch = parsed.pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
      if (shortsMatch) {
        return shortsMatch[1];
      }
      if (parsed.hostname.includes('youtu.be')) {
        return parsed.pathname.replace(/^\//, '').split('?')[0];
      }
    }
    return url;
  } catch (_) { }
  return null;
}

function checkVideoUrl(url: string) {
  const isDirect = isDirectMediaUrl(url);
  const isVideo = url.includes('/watch') || url.includes('/shorts/') || isDirect;
  isVideoPage.value = isVideo;
  if (isVideo) {
    if (isDirect && (!activeVideoTitle.value || activeVideoTitle.value === 'YouTube')) {
      activeVideoTitle.value = extractMediaTitle(url);
    }
    const vidId = getVideoId(url);
    if (vidId && vidId !== currentPreloadedVideoId.value) {
      loadAudioForWaveform(url);
    }
  } else {
    currentPreloadedVideoId.value = null;
    audioBuffer.value = null;
    originalAudioBuffer.value = null;
    audioDuration.value = 0;
    isLoadingAudio.value = false;
  }
}

// Navigation methods
function goBack() {
  const wv = webviewRef.value;
  if (wv && wv.canGoBack()) wv.goBack();
}

function goForward() {
  const wv = webviewRef.value;
  if (wv && wv.canGoForward()) wv.goForward();
}

function reloadPage() {
  const wv = webviewRef.value;
  if (wv) {
    if (isLoading.value) wv.stop();
    else wv.reload();
  }
}

function goHome() {
  const wv = webviewRef.value;
  if (wv) {
    wv.loadURL('https://www.youtube.com');
  }
}

function handleNavigate() {
  let target = inputUrl.value.trim();
  if (!target) return;

  if (target.startsWith('http://') || target.startsWith('https://')) {
    navigateToUrl(target);
  } else if (target.includes('.') && !target.includes(' ')) {
    navigateToUrl(`https://${target}`);
  } else {
    navigateToUrl(`https://www.youtube.com/results?search_query=${encodeURIComponent(target)}`);
  }
}

function navigateToUrl(url: string) {
  const wv = webviewRef.value;
  if (wv) {
    wv.loadURL(url);
  }
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      inputUrl.value = text.trim();
      handleNavigate();
    }
  } catch (_) { }
}

async function readVideoState() {
  const wv = webviewRef.value;
  if (!wv) return;

  try {
    const script = `
      (() => {
        const video = document.querySelector('video, audio');
        const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.title yt-formatted-string, ytd-reel-player-header-renderer h2, #title h1');
        const rawDocTitle = document.title ? document.title.replace(/\\s*-\\s*YouTube$/, '').trim() : '';
        const cleanedTitle = rawDocTitle.replace(/\\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|webm|weba|wma|aiff|aif|mp4)$/i, '').trim();
        return {
          title: titleEl ? titleEl.textContent?.trim() : cleanedTitle,
          currentTime: video ? video.currentTime : 0,
          duration: video ? video.duration : null,
          paused: video ? video.paused : true,
          videoWidth: video ? (video.videoWidth || 0) : 0,
          videoHeight: video ? (video.videoHeight || 0) : 0,
        };
      })()
    `;
    const res = await wv.executeJavaScript(script);
    if (res) {
      if (res.title && (!activeVideoTitle.value || activeVideoTitle.value === 'YouTube')) {
        activeVideoTitle.value = res.title;
      }
      if (res.duration && !Number.isNaN(res.duration)) {
        videoTotalDuration.value = res.duration;
        videoDurationFormatted.value = formatTime(res.duration);
      }
      if (res.currentTime !== undefined) {
        currentVideoTime.value = res.currentTime;
      }
      if (res.videoWidth && res.videoHeight) {
        isShortVideo.value = res.videoHeight > res.videoWidth;
      }
    }
  } catch (_) { }
}

async function captureVideoFrameFromWebview(): Promise<string | null> {
  const wv = webviewRef.value;
  if (!wv) return null;
  try {
    const script = `
      (() => {
        const v = document.querySelector('video');
        if (!v || !v.videoWidth || !v.videoHeight) return null;
        const canvas = document.createElement('canvas');
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(v, 0, 0, v.videoWidth, v.videoHeight);
        return canvas.toDataURL('image/jpeg', 0.95);
      })()
    `;
    const dataUrl = await wv.executeJavaScript(script);
    return dataUrl || null;
  } catch (err) {
    console.warn('captureVideoFrameFromWebview failed:', err);
    return null;
  }
}

async function cleanAndCropArtwork(src: string, isShort: boolean): Promise<string> {
  if (!src) return src;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) {
          resolve(src);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0);

        let imgData: ImageData | null = null;
        try {
          imgData = ctx.getImageData(0, 0, w, h);
        } catch (_) { }

        const data = imgData ? imgData.data : null;
        const getBrightness = (x: number, y: number) => {
          if (!data) return 128;
          const idx = (y * w + x) * 4;
          return data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
        };

        if (isShort) {
          let left = 0;
          let right = w - 1;

          if (data) {
            while (left < w * 0.35) {
              let darkCount = 0;
              const samples = 25;
              for (let i = 0; i < samples; i++) {
                const y = Math.floor((h * (i + 1)) / (samples + 1));
                if (getBrightness(left, y) < 30) darkCount++;
              }
              if (darkCount > samples * 0.9) left++;
              else break;
            }

            while (right > w * 0.65) {
              let darkCount = 0;
              const samples = 25;
              for (let i = 0; i < samples; i++) {
                const y = Math.floor((h * (i + 1)) / (samples + 1));
                if (getBrightness(right, y) < 30) darkCount++;
              }
              if (darkCount > samples * 0.9) right--;
              else break;
            }
          }

          const detectedCropWidth = right - left + 1;
          if (detectedCropWidth < w * 0.95 && detectedCropWidth >= w * 0.3) {
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = detectedCropWidth;
            cropCanvas.height = h;
            const cropCtx = cropCanvas.getContext('2d');
            if (cropCtx) {
              cropCtx.drawImage(canvas, left, 0, detectedCropWidth, h, 0, 0, detectedCropWidth, h);
              resolve(cropCanvas.toDataURL('image/jpeg', 0.95));
              return;
            }
          }
        } else {
          let top = 0;
          let bottom = h - 1;

          if (data) {
            while (top < h * 0.35) {
              let darkCount = 0;
              const samples = 25;
              for (let i = 0; i < samples; i++) {
                const x = Math.floor((w * (i + 1)) / (samples + 1));
                if (getBrightness(x, top) < 30) darkCount++;
              }
              if (darkCount > samples * 0.9) top++;
              else break;
            }

            while (bottom > h * 0.65) {
              let darkCount = 0;
              const samples = 25;
              for (let i = 0; i < samples; i++) {
                const x = Math.floor((w * (i + 1)) / (samples + 1));
                if (getBrightness(x, bottom) < 30) darkCount++;
              }
              if (darkCount > samples * 0.9) bottom--;
              else break;
            }
          }

          const detectedCropHeight = bottom - top + 1;
          if (detectedCropHeight < h * 0.95 && detectedCropHeight >= h * 0.5) {
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = w;
            cropCanvas.height = detectedCropHeight;
            const cropCtx = cropCanvas.getContext('2d');
            if (cropCtx) {
              cropCtx.drawImage(canvas, 0, top, w, detectedCropHeight, 0, 0, w, detectedCropHeight);
              resolve(cropCanvas.toDataURL('image/jpeg', 0.95));
              return;
            }
          }

          const aspect = w / h;
          if (aspect >= 1.25 && aspect <= 1.45) {
            const targetHeight = Math.round(w * (9 / 16));
            const cropY = Math.floor((h - targetHeight) / 2);
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = w;
            cropCanvas.height = targetHeight;
            const cropCtx = cropCanvas.getContext('2d');
            if (cropCtx) {
              cropCtx.drawImage(canvas, 0, cropY, w, targetHeight, 0, 0, w, targetHeight);
              resolve(cropCanvas.toDataURL('image/jpeg', 0.95));
              return;
            }
          }
        }

        resolve(src);
      } catch (err) {
        console.warn('cleanAndCropArtwork error:', err);
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

async function handleCaptureCurrentFrame() {
  if (isCapturingFrame.value) return;
  isCapturingFrame.value = true;
  try {
    const frame = await captureVideoFrameFromWebview();
    if (frame) {
      thumbnailUrl.value = await cleanAndCropArtwork(frame, isShortVideo.value);
    }
  } catch (err) {
    console.warn('Could not capture current frame:', err);
  } finally {
    isCapturingFrame.value = false;
  }
}

function getAudioContext(): AudioContext {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => { });
  }
  return audioContext;
}

async function loadAudioForWaveform(targetUrlOverride?: string | unknown) {
  const targetUrl = typeof targetUrlOverride === 'string' ? targetUrlOverride : currentUrl.value;
  const vidId = getVideoId(targetUrl);
  if (!vidId) return;

  if (currentPreloadedVideoId.value === vidId && audioBuffer.value) {
    return;
  }

  if (isLoadingAudio.value && currentAudioLoadUrl === targetUrl) {
    return;
  }

  currentAudioLoadUrl = targetUrl;
  currentPreloadedVideoId.value = vidId;

  isLoadingAudio.value = true;
  audioLoadError.value = '';
  audioLoadProgress.value = 5;
  audioLoadStatus.value = 'Preloading audio...';
  audioBuffer.value = null;
  originalAudioBuffer.value = null;

  try {
    let result: any = null;
    try {
      result = await window.electron?.ytDownloadClip({
        url: targetUrl,
      });
    } catch (e) {
      console.warn('ytDownloadClip direct download failed, trying webview fallback:', e);
    }

    if (currentAudioLoadUrl !== targetUrl) return;

    // Webview fallback for site-authenticated or session-dependent media
    if (!result || !result.success || !result.buffer) {
      try {
        const base64Data = await webviewRef.value?.executeJavaScript(`
          (async () => {
            try {
              const res = await fetch(${JSON.stringify(targetUrl)});
              if (!res.ok) return null;
              const buf = await res.arrayBuffer();
              const u8 = new Uint8Array(buf);
              let bin = '';
              const chunk = 8192;
              for (let i = 0; i < u8.length; i += chunk) {
                bin += String.fromCharCode.apply(null, u8.subarray(i, Math.min(i + chunk, u8.length)));
              }
              return btoa(bin);
            } catch (_) {
              return null;
            }
          })()
        `);
        if (base64Data) {
          const binaryStr = atob(base64Data);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          result = {
            success: true,
            buffer: bytes,
          };
        }
      } catch (_) { }
    }

    if (currentAudioLoadUrl !== targetUrl) return;

    if (!result || !result.success || !result.buffer) {
      throw new Error('Could not download audio stream from URL');
    }

    audioLoadProgress.value = 90;
    audioLoadStatus.value = 'Decoding audio waveform...';

    const ctx = getAudioContext();
    const rawBuffer = result.buffer;
    const uint8 = rawBuffer instanceof Uint8Array
      ? rawBuffer
      : ArrayBuffer.isView(rawBuffer)
        ? new Uint8Array(rawBuffer.buffer, rawBuffer.byteOffset, rawBuffer.byteLength)
        : new Uint8Array(rawBuffer);

    const cleanArrayBuffer = new ArrayBuffer(uint8.byteLength);
    new Uint8Array(cleanArrayBuffer).set(uint8);

    const decoded = await ctx.decodeAudioData(cleanArrayBuffer);
    if (currentAudioLoadUrl !== targetUrl) return;

    audioBuffer.value = decoded;
    originalAudioBuffer.value = decoded;
    audioDuration.value = decoded.duration;

    audioLoadProgress.value = 100;
    audioLoadStatus.value = 'Ready';
  } catch (err: any) {
    if (currentAudioLoadUrl !== targetUrl) return;
    console.error('Failed to load audio for waveform:', err);
    audioLoadError.value = err.message || 'Failed to load audio stream';
    currentPreloadedVideoId.value = null;
  } finally {
    if (currentAudioLoadUrl === targetUrl) {
      isLoadingAudio.value = false;
    }
  }
}

function toggleClipDrawer() {
  if (isDrawerOpen.value) {
    closeClipDrawer();
  } else {
    openClipDrawer();
  }
}

async function openClipDrawer() {
  // Immediately expand panel and toggle button so it turns into the collapse button with zero lag
  isDrawerOpen.value = true;

  try {
    await webviewRef.value?.executeJavaScript('document.querySelector("video, audio")?.pause()');
  } catch (_) { }

  if (isDirectMediaUrl(currentUrl.value) && (!activeVideoTitle.value || activeVideoTitle.value === 'YouTube')) {
    activeVideoTitle.value = extractMediaTitle(currentUrl.value);
  }

  const isShort = currentUrl.value.includes('/shorts/');
  isShortVideo.value = isShort;

  readVideoState().catch(() => { });

  // Non-blocking live frame capture
  captureVideoFrameFromWebview()
    .then(async (liveFrame) => {
      if (liveFrame) {
        thumbnailUrl.value = await cleanAndCropArtwork(liveFrame, isShortVideo.value);
      }
    })
    .catch(() => { });

  // Non-blocking oEmbed metadata fetch
  if (window.electron?.ytFetchInfo) {
    window.electron.ytFetchInfo(currentUrl.value)
      .then(async (info) => {
        if (info && info.success) {
          if (info.isShort !== undefined) isShortVideo.value = info.isShort;
          if (info.title && !activeVideoTitle.value) activeVideoTitle.value = info.title;
          if (!thumbnailUrl.value && info.thumbnailUrl) {
            thumbnailUrl.value = await cleanAndCropArtwork(info.thumbnailUrl, isShortVideo.value);
          }
        }
      })
      .catch(() => { });
  }

  if (!audioBuffer.value && !isLoadingAudio.value) {
    loadAudioForWaveform();
  }
}

function closeClipDrawer() {
  closeContextMenu();
  clipPanelRef.value?.stopAudio?.();
  isDrawerOpen.value = false;
}

function handleKeydown(e: KeyboardEvent) {
  if (route.path !== '/youtube') return;

  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'f' || e.code === 'KeyF')) {
    e.preventDefault();
    e.stopPropagation();
    openFindBar();
    return;
  }

  if (e.key === 'Escape') {
    if (isFindBarOpen.value) {
      e.preventDefault();
      e.stopPropagation();
      closeFindBar();
      return;
    }
    if (activeMenu.value) {
      closeContextMenu();
      return;
    }
    if (isDrawerOpen.value) {
      closeClipDrawer();
    }
  }
}

function focusAddressBar() {
  addressInputRef.value?.select();
}

function handleAddressBarEscape(e: KeyboardEvent) {
  if (activeMenu.value) {
    closeContextMenu();
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  const inputEl = addressInputRef.value;
  if (!inputEl) return;

  const start = inputEl.selectionStart ?? 0;
  const end = inputEl.selectionEnd ?? 0;
  const hasSelection = start !== end;
  const isModified = inputUrl.value !== currentUrl.value;

  e.preventDefault();
  e.stopPropagation();

  // 1. First Escape: if text is currently selected, deselect/collapse the selection while keeping focus
  if (hasSelection) {
    inputEl.setSelectionRange(end, end);
    return;
  }

  // 2. Second Escape: if URL was modified, reset back to current page URL while keeping focus
  if (isModified) {
    inputUrl.value = currentUrl.value;
    nextTick(() => {
      inputEl.focus();
      const len = inputUrl.value.length;
      inputEl.setSelectionRange(len, len);
    });
    return;
  }

  // 3. Subsequent Escape: unmodified and unselected -> blur address bar and return focus to page
  inputEl.blur();
  try {
    webviewRef.value?.focus?.();
  } catch (_) { }
}

let handleWebviewBeforeInputFn: ((e: any) => void) | null = null;
let handleConsoleMessageFn: ((e: any) => void) | null = null;
let injectWebviewKeydownListener: (() => void) | null = null;

// Lifecycle and event listeners
onMounted(() => {
  window.addEventListener('keydown', handleKeydown, true);
  window.addEventListener('resize', closeContextMenu);
  window.addEventListener('blur', closeContextMenu);
  window.addEventListener('mousemove', updateMousePos, { passive: true });

  // Native Electron main process IPC hook (guaranteed to catch Ctrl+F inside webview)
  window.electron?.onTriggerFindInPage?.(() => {
    if (route.path === '/youtube') {
      openFindBar();
    }
  });

  window.electron?.onWebviewEscape?.(() => {
    if (route.path === '/youtube' && isFindBarOpen.value) {
      closeFindBar();
    }
  });

  const wv = webviewRef.value;
  if (!wv) return;

  handleWebviewBeforeInputFn = (e: any) => {
    const isKeyDown = e.type === 'keyDown' || e.type === 'keydown';
    if (!isKeyDown) return;

    const isCtrlOrMeta = !!(e.control || e.meta);
    const key = (e.key || '').toLowerCase();
    const isF = key === 'f' || e.code === 'KeyF';

    if (isCtrlOrMeta && isF) {
      e.preventDefault?.();
      openFindBar();
    } else if ((key === 'escape' || e.code === 'Escape') && isFindBarOpen.value) {
      e.preventDefault?.();
      closeFindBar();
    }
  };

  // Injected client script fallback for inside YouTube webview
  injectWebviewKeydownListener = () => {
    try {
      wv.executeJavaScript(`
        (() => {
          if (window.__pulseFindInPageInstalled) return;
          window.__pulseFindInPageInstalled = true;
          window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F' || e.code === 'KeyF')) {
              e.preventDefault();
              e.stopPropagation();
              console.log('__PULSE_ACTION_FIND__');
            } else if (e.key === 'Escape') {
              console.log('__PULSE_ACTION_ESCAPE__');
            }
          }, true);
        })()
      `).catch(() => { });
    } catch (_) { }
  };

  handleConsoleMessageFn = (e: any) => {
    if (e.message === '__PULSE_ACTION_FIND__') {
      openFindBar();
    } else if (e.message === '__PULSE_ACTION_ESCAPE__') {
      if (isFindBarOpen.value) {
        closeFindBar();
      }
    }
  };

  wv.addEventListener('before-input-event', handleWebviewBeforeInputFn);
  wv.addEventListener('console-message', handleConsoleMessageFn);
  wv.addEventListener('dom-ready', injectWebviewKeydownListener);
  wv.addEventListener('did-navigate', injectWebviewKeydownListener);
  wv.addEventListener('did-navigate-in-page', injectWebviewKeydownListener);
  wv.addEventListener('context-menu', handleWebviewContextMenu);

  wv.addEventListener('did-start-loading', () => {
    isLoading.value = true;
    closeContextMenu();
  });

  wv.addEventListener('did-stop-loading', () => {
    isLoading.value = false;
    injectWebviewKeydownListener?.();
    try {
      canGoBack.value = typeof wv.canGoBack === 'function' ? wv.canGoBack() : false;
      canGoForward.value = typeof wv.canGoForward === 'function' ? wv.canGoForward() : false;
    } catch (_) { }
  });

  const updateLocation = () => {
    closeContextMenu();
    injectWebviewKeydownListener?.();
    try {
      const url = wv.getURL();
      if (url) {
        currentUrl.value = url;
        inputUrl.value = url;
        checkVideoUrl(url);
      }
      canGoBack.value = typeof wv.canGoBack === 'function' ? wv.canGoBack() : false;
      canGoForward.value = typeof wv.canGoForward === 'function' ? wv.canGoForward() : false;
      readVideoState();
    } catch (_) { }
  };

  wv.addEventListener('did-navigate', updateLocation);
  wv.addEventListener('did-navigate-in-page', updateLocation);
  wv.addEventListener('page-title-updated', (e: any) => {
    if (e.title) {
      const clean = e.title
        .replace(/\s*-\s*YouTube$/, '')
        .replace(/\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|webm|weba|wma|aiff|aif|mp4)$/i, '')
        .trim();
      if (clean && clean !== 'YouTube') {
        activeVideoTitle.value = clean;
      }
    }
  });

  window.electron?.onYtDownloadProgress(progress => {
    if (isLoadingAudio.value) {
      audioLoadProgress.value = Math.min(88, Math.max(5, progress.percent));
      if (progress.text) audioLoadStatus.value = progress.text;
    }
  });

  videoHeartbeatTimer = setInterval(() => {
    if (isVideoPage.value) {
      readVideoState();
    }
  }, 1000);
});

function handleDeactivate() {
  isViewActive.value = false;
  closeContextMenu();
  closeClipDrawer();
  closeFindBar();
  if (videoHeartbeatTimer) {
    clearInterval(videoHeartbeatTimer);
    videoHeartbeatTimer = null;
  }
  try {
    webviewRef.value?.executeJavaScript('document.querySelector("video, audio")?.pause()');
  } catch (_) { }
}

function handleActivate() {
  isViewActive.value = true;
  injectWebviewKeydownListener?.();
  if (!videoHeartbeatTimer) {
    videoHeartbeatTimer = setInterval(() => {
      if (isVideoPage.value) {
        readVideoState();
      }
    }, 1000);
  }
}

watch(
  () => props.active,
  (isActive) => {
    if (isActive) {
      handleActivate();
    } else {
      handleDeactivate();
    }
  }
);



onUnmounted(() => {
  closeContextMenu();
  window.removeEventListener('keydown', handleKeydown, true);
  window.removeEventListener('resize', closeContextMenu);
  window.removeEventListener('blur', closeContextMenu);
  window.removeEventListener('mousemove', updateMousePos);

  const wv = webviewRef.value;
  if (wv) {
    try {
      if (handleWebviewBeforeInputFn) wv.removeEventListener('before-input-event', handleWebviewBeforeInputFn);
      if (handleConsoleMessageFn) wv.removeEventListener('console-message', handleConsoleMessageFn);
      if (injectWebviewKeydownListener) {
        wv.removeEventListener('dom-ready', injectWebviewKeydownListener);
        wv.removeEventListener('did-navigate', injectWebviewKeydownListener);
        wv.removeEventListener('did-navigate-in-page', injectWebviewKeydownListener);
      }
      wv.removeEventListener('context-menu', handleWebviewContextMenu);
    } catch (_) { }
  }

  if (videoHeartbeatTimer) {
    clearInterval(videoHeartbeatTimer);
    videoHeartbeatTimer = null;
  }
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close().catch(() => { });
  }
});
</script>

<style scoped>
.youtube-view-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  flex: 1;
  background: var(--background-color);
  overflow: hidden;
  position: relative;
}

/* Browser Navbar */
.browser-navbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--top-toolbar-color, #2d2d2d);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
  z-index: 20;
}

.nav-buttons {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.375rem;
  color: var(--text-color);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nav-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.address-bar-wrapper {
  display: flex;
  align-items: center;
  flex: 1;
  position: relative;
  background: var(--input-bg-color, rgba(0, 0, 0, 0.25));
  border-radius: 0.375rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0 0.5rem;
}

.search-icon {
  margin-right: 0.375rem;
  flex-shrink: 0;
}

.address-input {
  flex: 1;
  height: 2rem;
  background: transparent;
  border: none;
  color: var(--text-color);
  font-size: 0.85rem;
  outline: none;
}

.clear-input-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  padding: 0 0.25rem;
}

.clear-input-btn:hover {
  color: #fff;
}

/* Address Bar Actions (Paste & Overflow 3-dots) */
.address-actions-group {
  display: inline-flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.25rem;
  margin-left: 0.35rem;
  overflow: hidden;
  flex-shrink: 0;
}

.address-actions-group .paste-btn {
  background: transparent;
  border: none;
  color: var(--text-color);
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.15rem 0.5rem;
  border-radius: 0;
  margin: 0;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.address-actions-group .paste-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.address-actions-group .overflow-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-color);
  padding: 0.2rem 0.35rem;
  border-radius: 0;
  margin: 0;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.address-actions-group .overflow-btn:hover,
.address-actions-group .overflow-btn.is-active {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.overflow-icon {
  width: 0.85rem;
  height: 0.85rem;
}


button:focus-visible {
  outline: 2px solid var(--primary-color);
}

/* Main Content Area */
.youtube-main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
  position: relative;
  overflow: hidden;
  /* Single CSS variable controlling the entire slide-up/down animation duration */
  --drawer-anim-duration: 0.45s;
  --dock-bar-height: 46px;
}

/* Webview Wrapper */
.webview-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  transition: height var(--drawer-anim-duration) ease;
}

.webview-wrapper.has-dock-bar {
  height: calc(100% - var(--dock-bar-height));
}

.webview-wrapper.is-covered {
  pointer-events: none;
}

.youtube-webview {
  width: 100%;
  height: 100%;
  border: none;
}

/* Clip Dock Panel & Bottom Bar: Entire Unified Card */
.clip-dock-panel {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #18181b;
  overflow: hidden;
  z-index: 10;
  transform: translateY(calc(100% - var(--dock-bar-height)));
  transition: transform var(--drawer-anim-duration) cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform;
}

.clip-dock-panel.is-expanded {
  transform: translateY(0);
}

/* Video Info Strip (the bar: header of the card) */
.video-info-strip {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0 0.85rem;
  height: var(--dock-bar-height);
  background: var(--top-toolbar-color, #27272a);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.85rem;
  color: var(--text-color, #e0e0e0);
  flex-shrink: 0;
  box-sizing: border-box;
}

.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #23a459;
  box-shadow: 0 0 6px #23a459;
  flex-shrink: 0;
}

.video-title-text {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  font-size: 0.88rem;
  color: #fff;
}

/* Unified Action / Morphing Button in the Bar */
.clip-action-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 2.15rem;
  border-radius: 0.375rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  overflow: hidden;
  padding: 0;
  border: 1px solid transparent;
  box-sizing: border-box;
  transition: width var(--drawer-anim-duration) cubic-bezier(0.16, 1, 0.3, 1),
    background-color var(--drawer-anim-duration) cubic-bezier(0.16, 1, 0.3, 1),
    border-color var(--drawer-anim-duration) cubic-bezier(0.16, 1, 0.3, 1),
    color var(--drawer-anim-duration) cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow var(--drawer-anim-duration) cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.15s ease;
}

.btn-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0 0.85rem;
  height: 100%;
  width: 100%;
  box-sizing: border-box;
}

/* 1. Collapse State (when expanded at the top) */
.clip-action-btn.is-collapse {
  width: 7.25rem;
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.25);
  color: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

.clip-action-btn.is-collapse:hover {
  background: rgba(255, 255, 255, 0.22);
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-1px);
}

.clip-action-btn.is-collapse:focus-visible {
  outline: 2px solid var(--active-color, #38bdf8);
  outline-offset: 2px;
  background: rgba(255, 255, 255, 0.22);
}

/* 2. Active Ready State (when collapsed at the bottom) */
.clip-action-btn.is-active {
  width: 14rem;
  background: #23a459;
  border-color: #2ea32e;
  color: #fff;
  box-shadow: 0 2px 8px rgba(35, 164, 89, 0.35);
}

.clip-action-btn.is-active.has-ready {
  width: 17.5rem;
}

.clip-action-btn.is-active:hover {
  background: #2bb965;
  border-color: #34c76f;
  box-shadow: 0 2px 12px rgba(35, 164, 89, 0.55);
}

.clip-action-btn.is-active:focus-visible {
  outline: 2px solid var(--active-color, #23a459);
  outline-offset: 2px;
  background: #2bb965;
}

.clip-action-btn.pulse {
  animation: clipPulse 2s infinite;
}

@keyframes clipPulse {
  0% {
    box-shadow: 0 0 0 0 rgba(35, 164, 89, 0.6);
  }

  70% {
    box-shadow: 0 0 0 8px rgba(35, 164, 89, 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(35, 164, 89, 0);
  }
}

/* 3. Loading Audio State */
.clip-action-btn.is-loading {
  width: 14rem;
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.35);
}

.clip-action-btn.is-loading:hover {
  border-color: rgba(16, 185, 129, 0.6);
  background: rgba(16, 185, 129, 0.18);
}

.clip-action-btn.is-loading:focus-visible {
  outline: 2px solid var(--active-color, #10b981);
  outline-offset: 2px;
}

.clip-preload-strip-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  background: linear-gradient(90deg, rgba(35, 164, 89, 0.3), rgba(16, 185, 129, 0.55));
  transition: width 0.25s ease;
  pointer-events: none;
}

.clip-preload-strip-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0 0.75rem;
  color: #fff;
  font-size: 0.82rem;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
  white-space: nowrap;
}

/* Button Morph Crossfade */
.btn-morph-enter-active,
.btn-morph-leave-active {
  transition: opacity calc(var(--drawer-anim-duration) * 0.35) ease,
    transform calc(var(--drawer-anim-duration) * 0.35) ease;
}

.btn-morph-enter-from {
  opacity: 0;
  transform: translateY(-4px) scale(0.96);
}

.btn-morph-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(0.96);
}

.ready-badge {
  display: inline-flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.25);
  padding: 0.1rem 0.4rem;
  border-radius: 9999px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  margin-left: 0.25rem;
}

/* Revealed Component Container (Card Body + Footer) */
.clip-component-wrapper {
  flex: 1 1 0px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  width: 100%;
}

.clip-dock-panel:not(.is-expanded) .clip-component-wrapper {
  pointer-events: none;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Context Menu Styles */
.pulse-context-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99998;
  background: transparent;
  cursor: default;
}

.pulse-context-menu {
  position: fixed;
  z-index: 99999;
  min-width: 215px;
  max-width: 320px;
  background: #18181b;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 0.35rem;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.95), 0 4px 12px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  user-select: none;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  transform-origin: top left;
}

.context-menu-fade-enter-active,
.context-menu-fade-leave-active {
  transition: opacity 0.12s ease, transform 0.12s cubic-bezier(0.16, 1, 0.3, 1);
}

.context-menu-fade-enter-from {
  opacity: 0;
  transform: scale(0.96) translateY(-3px);
}

.context-menu-fade-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

.menu-section-header {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #a1a1aa;
  padding: 0.25rem 0.5rem 0.15rem;
}

.menu-preview-header {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.72rem;
  color: #a1a1aa;
  padding: 0.35rem 0.5rem;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 5px;
  margin-bottom: 0.2rem;
  max-width: 100%;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  padding: 0.42rem 0.6rem;
  background: transparent;
  border: none;
  border-radius: 5px;
  color: #f4f4f5;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.1s ease, color 0.1s ease;
  white-space: nowrap;
}

.context-menu-item:hover:not(:disabled) {
  background-color: #27272a;
  color: #ffffff;
}

.context-menu-item:active:not(:disabled) {
  background-color: #23a459;
  color: #ffffff;
}

.context-menu-item:disabled {
  opacity: 0.38;
  cursor: not-allowed;
  pointer-events: none;
}

.item-icon {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  color: #a1a1aa;
  transition: color 0.1s ease;
}

.context-menu-item:hover:not(:disabled) .item-icon {
  color: #ffffff;
}

.item-shortcut {
  margin-left: auto;
  font-size: 0.7rem;
  color: #71717a;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.item-badge {
  margin-left: auto;
  margin-right: 0.35rem;
  font-size: 0.65rem;
  font-weight: 600;
  background: rgba(35, 164, 89, 0.2);
  color: #abffab;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
}

.menu-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 0.2rem 0.3rem;
}

.context-menu-item.audio-highlight-item {
  background: rgba(35, 164, 89, 0.12);
  border: 1px solid rgba(35, 164, 89, 0.22);
  color: #abffab;
  padding: 0.45rem 0.65rem;
}

.context-menu-item.audio-highlight-item:hover {
  background: rgba(35, 164, 89, 0.24);
  color: #ffffff;
}

.context-menu-item.audio-highlight-item .item-icon {
  color: #34d399;
}
</style>
