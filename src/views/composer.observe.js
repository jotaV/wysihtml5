/**
 * Taking care of events
 *  - Simulating 'change' event on contentEditable element
 *  - Handling drag & drop logic
 *  - Catch paste events
 *  - Dispatch proprietary newword:composer event
 *  - Keyboard shortcuts
 *  - Error prevention
 *  - Auto-correct
 */
(function(wysihtml5) {
  var dom       = wysihtml5.dom,
      browser   = wysihtml5.browser;

  /**
   * Map keyCodes to query commands
   */
  var shortcuts = {};

  wysihtml5.views.Composer.prototype.observe = function() {
    var that                = this,
        state               = this.getValue(),
        iframe              = this.sandbox.getIframe(),
        element             = this.element,
        focusBlurElement    = browser.supportsEventsInIframeCorrectly() ? element : this.sandbox.getWindow(),
        pasteEvents         = ["drop", "paste"];

    var confShortcuts = this.config.shortcuts;
    confShortcuts.bold !== false ? shortcuts[confShortcuts.bold.charCodeAt(0)] = "bold" : false;
    confShortcuts.italic !== false ? shortcuts[confShortcuts.italic.charCodeAt(0)] = "italic" : false;
    confShortcuts.underline !== false ? shortcuts[confShortcuts.underline.charCodeAt(0)] = "underline" : false;

    this.minIframeHeight = parseInt(iframe.style.height.replace('px',''), 10);

    //----------- Returns the current offset of the caret without counting the line breaks
    this._getCaretOffset = (function (el) {
      var doc = el.ownerDocument || el.document;
      var win = doc.defaultView || doc.parentWindow;

      return function () {
        var sel, range, preCaretRange, caretOffset = 0;
        if (typeof win.getSelection != "undefined") {
          sel = win.getSelection();
          if (sel.rangeCount) {
            range = sel.getRangeAt(0);
            preCaretRange = range.cloneRange();

            preCaretRange.selectNodeContents(el);
            preCaretRange.setEnd(range.endContainer, range.endOffset);

            var preCaretOffset = preCaretRange.toString().replace(/\n{2,}/g, '');
            caretOffset = preCaretOffset.length;

            var match = preCaretOffset.match(/\n/g);
            if (match !== null) {
              caretOffset -= match.length;
            }
          }
        } else if ((sel = doc.selection) && sel.type != "Control") {
          range = doc.selection.createRange();
          preCaretRange = doc.body.createTextRange();
          preCaretRange.moveToElementText(element);
          preCaretRange.setEndPoint("EndToEnd", textRange);
          caretOffset = preCaretTextRange.text.length + preCaretOffset;
        }
        return caretOffset;
      }
    })(element);

    // --------- Returns the text around the caret from lookback to lookahead
    this._getTextAroundCaret = function (charCode, lookback, lookahead) {
      var itxt = dom.getTextContent(that.element).replace(/\n|^\b/g, '');
      var chatTxt = String.fromCharCode(charCode);

      var caretPos = that._getCaretOffset();
      var str = itxt.substring(caretPos - lookback, caretPos + lookahead);
      return str.slice(0, lookback) + chatTxt + str.slice(lookback, str.length - 1);
    }

    // --------- Error prevention logic ---------
    this._applyDenyRules = function (rules, txt, event) {
      if (rules.length <= 0) {
        return false;
      } else if (txt.match(rules[0].rule)) {
        event.preventDefault();
        that.parent.fire("deny:composer", {
          rule:rules[0],
          text:txt
        });
        return true;
      } else {
        return this._applyDenyRules(rules.slice(1, rules.length), txt, event);
      }
    }

    // --------- Auto-correct logic ---------
    this._applyFixRules = function (rules, txt, chatTxt, event) {
      if (rules.length <= 0) {
        return false;
      } else if (rules[0].rule.test(txt)) {
        event.preventDefault();
        var fixed = rules[0].fix(chatTxt);
        that.commands.exec("insertHTML", fixed);
        that.parent.fire("fix:composer", {
          rule:rules[0],
          text:chatTxt,
          fixed:rules[0].fix(chatTxt)
        });
        return;
      } else {
        return this._applyFixRules(rules.slice(1, rules.length), txt, chatTxt, event);
      }
    }

    // --------- Error prevention and auto-correct logic ---------
    /*dom.observe(element, "keypress", function (event) {
      var str = that._getTextAroundCaret(event.charCode, that.config.caretOffset.left, that.config.caretOffset.right);

      if (that._applyDenyRules(that.config.parserRules.deny, str, event) !== true) {
          that._applyFixRules(that.config.parserRules.fix, str, String.fromCharCode(event.charCode), event);
      }
    });*/

    /**
     * Checks if a given node is child of some node of a kind
     * @param  Element  child           The child node
     * @param  string  expectedNodeName The parent node name 
     * @return {Boolean}                 
     */
    this._isChildOfA = function(child, expectedNodeName){
      var parent = child.parentNode;
      while(parent){
        if(parent.nodeName == expectedNodeName){
          return parent;
        } else {
          parent = parent.parentNode;
        }
      }

      return false;
    }

    dom.observe(element, "keypress", function(event){
      var selNode = that.selection.getSelectedNode(true);
      if(selNode && selNode.nodeName === "BODY"){
        if(that.selection.getText() === ""){
          event.preventDefault();
        }
      }
    });

    if(that.config.autoResize){
      this.doResize = function(){
        var iframeCurrHeight = parseInt(iframe.style.height.replace("px",""), 10);
        var bodyHeight = Math.min(element.offsetHeight, element.scrollHeight, element.clientHeight) + that.config.autoResizeMargin;

        if(bodyHeight >= iframeCurrHeight){
          iframe.style.height = bodyHeight + "px";
        } else if(bodyHeight > that.minIframeHeight){
          iframe.style.height = (iframeCurrHeight - (iframeCurrHeight - bodyHeight)) + "px";
        } else if (iframeCurrHeight > that.minIframeHeight && bodyHeight < that.minIframeHeight){
          iframe.style.height = that.minIframeHeight + "px";
        }
      };

      //resizing on startup
      this.doResize();
      dom.observe(element, ["imageloaded:composer", "change:composer", "keyup", "keydown", "paste", "change", "focus", "blur"], that.doResize);
      that.parent.on("disable:composer", that.doResize);
      that.parent.on("enable:composer", that.doResize);
      that.parent.on("imageloaded:composer", that.doResize);
      that.parent.on("beforeload", that.doResize);
      that.parent.on("load", that.doResize);
      that.parent.on("aftercommand:composer", that.doResize);
      that.parent.on("change:composer", that.doResize);
      that.parent.on("newword:composer", that.doResize);
      that.parent.on("change", that.doResize);
      that.parent.on('imageloaded:composer',that.doResize);

    } else {
      this.doResize = function() {}
    }

    // --------- destroy:composer event ---------
    dom.observe(iframe, "DOMNodeRemoved", function() {
      clearInterval(domNodeRemovedInterval);
      that.parent.fire("destroy:composer");
    });

    // DOMNodeRemoved event is not supported in IE 8
    var domNodeRemovedInterval = setInterval(function() {
      if (!dom.contains(document.documentElement, iframe)) {
        clearInterval(domNodeRemovedInterval);
        that.parent.fire("destroy:composer");
      }
    }, 250);

    // --------- Focus & blur logic ---------
    dom.observe(focusBlurElement, "focus", function() {
      that.parent.fire("focus").fire("focus:composer");

      // Delay storing of state until all focus handler are fired
      // especially the one which resets the placeholder
      setTimeout(function() { state = that.getValue(); }, 0);
    });

    dom.observe(focusBlurElement, "blur", function() {
      if (state !== that.getValue()) {
        that.parent.fire("change").fire("change:composer");
      }
      that.parent.fire("blur").fire("blur:composer");
    });

    // --------- Drag & Drop logic ---------
    dom.observe(element, "dragenter", function() {
      that.parent.fire("unset_placeholder");
    });

    dom.observe(element, pasteEvents, function() {
      setTimeout(function() {
        that.parent.fire("paste").fire("paste:composer");
      }, 0);
    });

    // --------- neword event ---------
    dom.observe(element, "keyup", function(event) {
      var keyCode = event.keyCode;
      if (keyCode === wysihtml5.SPACE_KEY || keyCode === wysihtml5.ENTER_KEY) {
        that.parent.fire("newword:composer");
      }
    });

    this.parent.on("paste:composer", function() {
      setTimeout(function() { that.parent.fire("newword:composer"); }, 0);
    });

    // --------- Make sure that images are selected when clicking on them ---------
    if (!browser.canSelectImagesInContentEditable()) {
      dom.observe(element, "mousedown", function(event) {
        var target = event.target;
        if (target.nodeName === "IMG") {
          that.selection.selectNode(target);
          event.preventDefault();
        }
      });
    }

    if (browser.hasHistoryIssue() && browser.supportsSelectionModify()) {
      dom.observe(element, "keydown", function(event) {
        if (!event.metaKey && !event.ctrlKey) {
          return;
        }

        var keyCode   = event.keyCode,
            win       = element.ownerDocument.defaultView,
            selection = win.getSelection();

        if (keyCode === 37 || keyCode === 39) {
          if (keyCode === 37) {
            selection.modify("extend", "left", "lineboundary");
            if (!event.shiftKey) {
              selection.collapseToStart();
            }
          }
          if (keyCode === 39) {
            selection.modify("extend", "right", "lineboundary");
            if (!event.shiftKey) {
              selection.collapseToEnd();
            }
          }
          event.preventDefault();
        }
      });
    }

    // --------- Shortcut logic ---------
    dom.observe(element, "keydown", function(event) {
      var keyCode  = event.keyCode,
          command  = shortcuts[keyCode];
      if ((event.ctrlKey || event.metaKey) && !event.altKey && command) {
        that.commands.exec(command);
        event.preventDefault();
      }
    });

    // --------- Make sure that when pressing backspace/delete on selected images deletes the image and it's anchor ---------
    dom.observe(element, "keydown", function(event) {
      var target  = that.selection.getSelectedNode(true),
          keyCode = event.keyCode,
          parent;
      if (target && target.nodeName === "IMG" && (keyCode === wysihtml5.BACKSPACE_KEY || keyCode === wysihtml5.DELETE_KEY)) { // 8 => backspace, 46 => delete
        parent = target.parentNode;
        // delete the <img>
        parent.removeChild(target);
        // and it's parent <a> too if it hasn't got any other child nodes
        if (parent.nodeName === "A" && !parent.firstChild) {
          parent.parentNode.removeChild(parent);
        }

        setTimeout(function() { wysihtml5.quirks.redraw(element); }, 0);
        event.preventDefault();
      }
    });

    // --------- Make sure that when pressing backspace/delete on a blockquote, it is unmade ---------
    dom.observe(element, "keydown", function(event) {
      var target  = that.selection.getSelectedNode(true),
          keyCode = event.keyCode,
          parent;
      if (keyCode === wysihtml5.BACKSPACE_KEY //if it's pressed backspace
        && that.selection.getSelection().anchorOffset == 0) { //and it's trying to delete it
        parent = that._isChildOfA(target,"BLOCKQUOTE");
        if(parent) { //and it's inside a blockquote
          
          var range = that.selection.getRange();
          range.setStartBefore(parent);
          var content = range.cloneContents();
          if(content.textContent.length <= 0){ //and finally, if it's at the beginning of the blockquote
            that.parent.toolbar.execCommand("formatBlock","blockquote");
            event.preventDefault();
          }
        }
      }
    });


    // --------- IE 8+9 focus the editor when the iframe is clicked (without actually firing the 'focus' event on the <body>) ---------
    if (browser.hasIframeFocusIssue()) {
      dom.observe(this.iframe, "focus", function() {
        setTimeout(function() {
          if (that.doc.querySelector(":focus") !== that.element) {
            that.focus();
          }
        }, 0);
      });

      dom.observe(this.element, "blur", function() {
        setTimeout(function() {
          that.selection.getSelection().removeAllRanges();
        }, 0);
      });
    }

    // --------- Show url in tooltip when hovering links or images ---------
    var titlePrefixes = {
      IMG: "Image: ",
      A:   "Link: "
    };

    dom.observe(element, "mouseover", function(event) {
      var target   = event.target,
          nodeName = target.nodeName,
          title;
      if (nodeName !== "A" && nodeName !== "IMG") {
        return;
      }
      var hasTitle = target.hasAttribute("title");
      if(!hasTitle){
        title = titlePrefixes[nodeName] + (target.getAttribute("href") || target.getAttribute("src"));
        target.setAttribute("title", title);
      }
    });
  };
})(wysihtml5);
