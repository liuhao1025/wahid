/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2016 DeNA Co., Ltd.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/// <reference path="base.js"/>
/// <reference path="display_object.js"/>
/// <reference path="graphics.js"/>
/// <reference path="config.js"/>

/**
 * A class that represents a vector shape.
 * @param {createjs.Graphics=} opt_graphics
 * @extends {createjs.DisplayObject}
 * @constructor
 */
createjs.Shape = function(opt_graphics) {
  createjs.DisplayObject.call(this);

  /**
   * The createjs.Graphics object that actually represents this shape.
   * @type {createjs.Graphics}
   * @private
   */
  this.graphics_ = opt_graphics ? opt_graphics : new createjs.Graphics();
};
createjs.inherits('Shape', createjs.Shape, createjs.DisplayObject);

/**
 * Createjs.Graphics objects to be set by a tween attached to this shape.
 * @type {Array.<createjs.Graphics>}
 * @private
 */
createjs.Shape.prototype.masks_ = null;

/**
 * The position where this shape was hit-tested last time.
 * @type {createjs.Point}
 * @private
 */
createjs.Shape.prototype.hitTestPoint_ = null;

/**
 * The result of the last hit-testing.
 * @type {createjs.DisplayObject}
 * @private
 */
createjs.Shape.prototype.hitTestResult_ = null;

/**
 * Returns the createjs.Graphics object owned by this object.
 * @return {createjs.Graphics}
 * @const
 */
createjs.Shape.prototype.getGraphics = function() {
  /// <returns type="createjs.Graphics"/>
  return this.graphics_;
};

/**
 * Sets the createjs.Graphics object.
 * @param {createjs.Graphics} graphics
 * @const
 */
createjs.Shape.prototype.setGraphics = function(graphics) {
  /// <param type="createjs.Graphics" name="graphics"/>
  var owners = this.getOwners();
  if (!owners) {
    return;
  }
  var composition = this.getCompositionId();
  if (composition) {
    // A mask uses its bounding box in the global coordinate system to render
    // its owners. Force its owners to calculate it. (Even though multiple
    // owners can share one mask, they create copies of the bounding box of the
    // mask to convert them to the global coordinate system. That is, it is safe
    // for multiple owners to share one mask.)
    this.graphics_ = graphics;
    if (graphics) {
      var box = graphics.box;
      this.setBoundingBox(box.minX, box.minY, box.maxX, box.maxY);
      for (var i = 0; i < owners.length; ++i) {
        owners[i].setDirty(createjs.DisplayObject.DIRTY_MASK);
      }
    }
  }
};

/** @override */
createjs.Shape.prototype.handleAttach = function(flag) {
  /// <param type="number" name="flag"/>
  var graphics = this.getGraphics();
  if (flag) {
    // Cache the associated Graphics object when this shape is added to an
    // object tree. (A CreateJS object generated by Flash CC adds child shapes
    // to its node list in its constructor, i.e. this code caches all child
    // shapes of a CreateJS object there.)
    graphics.cache(flag);
    if ((flag & 2) && this.masks_) {
      // Cache masks the first time when a display object has a mask attached,
      // i.e. "object.mask = shape" is executed.
      for (var i = 0; i < this.masks_.length; ++i) {
        this.masks_[i].cache(flag);
      }
    }
  }
  var box = graphics.box;
  this.setBoundingBox(box.minX, box.minY, box.maxX, box.maxY);
};

/** @override */
createjs.Shape.prototype.removeAllChildren = function(opt_destroy) {
  /// <param type="boolean" optional="true" name="opt_destroy"/>
  this.handleDetach();
};

/** @override */
createjs.Shape.prototype.handleDetach = function() {
  if (this.graphics_) {
    this.graphics_.uncache();
    this.graphics_ = null;
  }
  if (this.masks_) {
    for (var i = 0; i < this.masks_.length; ++i) {
      this.masks_[i].uncache();
    }
    this.masks_ = null;
  }
};

if (createjs.USE_PIXEL_TEST) {
  /** @override */
  createjs.Shape.prototype.hitTestObject = function(point, types, bubble) {
    var object = createjs.DisplayObject.prototype.hitTestObject.call(
        this, point, types, bubble);
    if (object && this.graphics_) {
      // Return the cached result if the given point is sufficiently close to
      // the last one. This method is often called twice with the same position
      // when a user taps on this shape: one is for a 'touchdown' event, and the
      // other is for a 'touchup' event. This cache avoids reading the pixels of
      // its createjs.Graphics object twice.
      if (this.hitTestPoint_) {
        var dx = this.hitTestPoint_.x - point.x;
        var dy = this.hitTestPoint_.y - point.y;
        if (dx * dx + dy * dy <= 4) {
          return this.hitTestResult_;
        }
        this.hitTestPoint_.x = point.x;
        this.hitTestPoint_.y = point.y;
      } else {
        this.hitTestPoint_ = new createjs.Point(point.x, point.y);
      }
      // Read the pixel at the specified position.
      var local = new createjs.Point(point.x, point.y);
      this.getInverse().transformPoint(local);
      if (!this.graphics_.hitTestObject(local)) {
        object = null;
      }
      this.hitTestResult_ = object;
    }
    return object;
  };
}

/** @override */
createjs.Shape.prototype.layout =
    function(renderer, parent, dirty, time, draw) {
  /// <param type="createjs.Renderer" name="renderer"/>
  /// <param type="createjs.DisplayObject" name="parent"/>
  /// <param type="number" name="dirty"/>
  /// <param type="number" name="time"/>
  /// <param type="number" name="draw"/>
  var graphics = this.graphics_;
  if (!graphics) {
    return 0;
  }
  if (graphics.isDirty()) {
    this.setDirty(createjs.DisplayObject.DIRTY_SHAPE);
    var box = graphics.box;
    this.setBoundingBox(box.minX, box.minY, box.maxX, box.maxY);
  }
  return createjs.Shape.superClass_.layout.call(
      this, renderer, parent, dirty, time, draw);
};

/** @override */
createjs.Shape.prototype.paintObject = function(renderer) {
  /// <returns type="createjs.Renderer"/>
  this.graphics_.paint(renderer);
};

/** @override */
createjs.Shape.prototype.isVisible = function() {
  /// <returns type="boolean"/>
  return !!this.graphics_ && !this.graphics_.isEmpty() &&
      createjs.Shape.superClass_.isVisible.call(this);
};

/** @override */
createjs.Shape.prototype.set = function(properties) {
  createjs.Shape.superClass_.set.call(this, properties);
  var value = properties['graphics'];
  if (value) {
    this.setGraphics(/** @type {createjs.Graphics} */ (value));
  }
  return this;
};

/** @override */
createjs.Shape.prototype.addGraphics = function(graphics) {
  /// <param type="createjs.Graphics" name="graphics"/>
  // Add the given graphics object to a list so this shape can create their
  // cache bitmaps when it is a mask and it has to clip its owners.
  if (graphics) {
    if (!this.masks_) {
      this.masks_ = [];
    }
    this.masks_.push(graphics);
  }
};

/** @override */
createjs.Shape.prototype.getSetters = function() {
  /// <return type="Object" elementType="createjs.TweenTarget.Setter"/>
  var setters = createjs.Shape.superClass_.getSetters.call(this);
  setters['graphics'].setGraphics(this.graphics_);
  return setters;
};

// Add a setter to allow tweens to change this object.
createjs.TweenTarget.Property.addSetters({
  'graphics': createjs.Shape.prototype.setGraphics
});

// Adds a getter and a setter for applications to access internal variables.
Object.defineProperties(createjs.Shape.prototype, {
  'graphics': {
    get: createjs.Shape.prototype.getGraphics,
    set: createjs.Shape.prototype.setGraphics
  }
});

// Export the createjs.Shape object to the global namespace.
createjs.exportObject('createjs.Shape', createjs.Shape, {
  // createjs.Object methods.
});
