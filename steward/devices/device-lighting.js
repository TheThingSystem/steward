var colorconv   = require('color-convert')
  , util        = require('util')
  , devices     = require('./../core/device')
  , steward     = require('./../core/steward')
  , utility     = require('./../core/utility')
  ;


var logger = exports.logger = utility.logger('lighting');


exports.start = function() {
  steward.actors.device.lighting = { $info: { type: '/device/lighting' }};

  utility.acquire(logger, __dirname + '/devices-lighting', /^lighting-.*\.js$/, 9, -3, ' driver');
};


exports.validBrightness  = function(bri)  { return ((  0 <= bri) && (bri <= 100)); };
exports.validHue         = function(hue)  { return ((  0 <= hue) && (hue <  360)); };
exports.validSaturation  = function(sat)  { return ((  0 <= sat) && (sat <= 100)); };
exports.validCIE1931     = function(xy)   { return ((0 <= xy.x) && (xy.x <= 1) && (0 <= xy.y) && (xy.y <= 1)); };
exports.validTemperature = function(mired){ return ((154 <= mired)  && (mired  <= 500)); };
exports.validCMYW        = function(cmyw) {
  return (   (0 <= cmyw.c) && (cmyw.c <= 100)
          && (0 <= cmyw.m) && (cmyw.m <= 100)
          && (0 <= cmyw.y) && (cmyw.y <= 100)
          && (0 <= cmyw.w) && (cmyw.w <= 100));
};
exports.validRGB         = function(rgb)  {
  return (   (0 <= rgb.r) && (rgb.r <= 255)
          && (0 <= rgb.g) && (rgb.g <= 255)
          && (0 <= rgb.b) && (rgb.b <= 255));
};
exports.validRGBOW       = function(rgbow) {
  return (   (0 <= rgbow.r) && (rgbow.r <= 255)
          && (0 <= rgbow.g) && (rgbow.g <= 255)
          && (0 <= rgbow.b) && (rgbow.b <= 255)
          && (0 <= rgbow.o) && (rgbow.o <= 255)
          && (0 <= rgbow.w) && (rgbow.w <= 255));
};
exports.validRGB16       = function(rgb16) {
  return (   (0 <= rgb16.r) && (rgb16.r <= 65535)
          && (0 <= rgb16.g) && (rgb16.g <= 65535)
          && (0 <= rgb16.b) && (rgb16.b <= 65535));
};


var Lighting = exports.Device = function() {
  var self = this;

  self.whatami = '/device/lighting';
};
util.inherits(Lighting, devices.Device);



// from https://github.com/bjohnso5/hue-hacking/colors.js


/**
 * Color utility functions, exposed as an AMD module.
 * No external dependencies.
 * Special thanks for the RGB to CIE conversion code goes out to the Q42 team
 * for their Q42.HueApi work. Dank u!
 * More info: https://github.com/Q42/Q42.HueApi.
 *
 * https://github.com/bjohnso5/hue-hacking
 * Copyright (c) 2013 Bryan Johnson; Licensed MIT */
var colors = function () {

    'use strict';

    /**
     * Represents a CIE 1931 XY coordinate pair.
     *
     * @param {Number} X coordinate.
     * @param {Number} Y coordinate.
     * @constructor
     */
    var XYPoint = function (x, y) {
        this.x = x;
        this.y = y;
    },

    Red = new XYPoint(0.675, 0.322),
    Lime = new XYPoint(0.4091, 0.518),
    Blue = new XYPoint(0.167, 0.04),

    /**
     * Parses a valid hex color string and returns the Red RGB integer value.
     *
     * @param {String} Hex color string.
     * @return {Number} Red integer value.
     */
    hexToRed = function (hex) {
        return parseInt( hex.substring(0, 2), 16 );
    },

    /**
     * Parses a valid hex color string and returns the Green RGB integer value.
     *
     * @param {String} Hex color string.
     * @return {Number} Green integer value.
     */
    hexToGreen = function (hex) {
        return parseInt( hex.substring(2, 4), 16 );
    },

    /**
     * Parses a valid hex color string and returns the Blue RGB integer value.
     *
     * @param {String} Hex color string.
     * @return {Number} Blue integer value.
     */
    hexToBlue = function (hex) {
        return parseInt( hex.substring(4, 6), 16 );
    },

    /**
     * Converts a valid hex color string to an RGB array.
     *
     * @param {String} Hex color String (e.g. FF00FF)
     * @return {Array} Array containing R, G, B values
     */
    hexToRGB = function (h) {
        var rgb = [hexToRed(h), hexToGreen(h), hexToBlue(h)];
        return rgb;
    },

    /**
     * Generates a random number between 'from' and 'to'.
     *
     * @param {Number} Number representing the start of a range.
     * @param {Number} Number representing the end of a range.
     */
    randomFromInterval = function (from /* Number */, to /* Number */) {
        return Math.floor(Math.random() * (to - from + 1) + from);
    },

    /**
     * Return a random Integer in the range of 0 to 255, representing an RGB
     * color value.
     *
     * @return {number} Integer between 0 and 255.
     */
    randomRGBValue = function () {
        return randomFromInterval(0, 255);
    },

    /**
     * Returns the cross product of two XYPoints.
     *
     * @param {XYPoint} Point 1.
     * @param {XYPoint} Point 2.
     * @return {Number} Cross-product of the two XYPoints provided.
     */
    crossProduct = function (p1, p2) {
        return (p1.x * p2.y - p1.y * p2.x);
    },

    /**
     * Check if the provided XYPoint can be recreated by a Hue lamp.
     *
     * @param {XYPoint} XYPoint to check.
     * @return {boolean} Flag indicating if the point is within reproducible range.
     */
    checkPointInLampsReach = function (p) {
        var v1 = new XYPoint(Lime.x - Red.x, Lime.y - Red.y),
            v2 = new XYPoint(Blue.x - Red.x, Blue.y - Red.y),

            q = new XYPoint(p.x - Red.x, p.y - Red.y),

            s = crossProduct(q, v2) / crossProduct(v1, v2),
            t = crossProduct(v1, q) / crossProduct(v1, v2);

        return (s >= 0.0) && (t >= 0.0) && (s + t <= 1.0);
    },

    /**
     * Find the closest point on a line. This point will be reproducible by a Hue lamp.
     *
     * @param {XYPoint} The point where the line starts.
     * @param {XYPoint} The point where the line ends.
     * @param {XYPoint} The point which is close to the line.
     * @return {XYPoint} A point that is on the line, and closest to the XYPoint provided.
     */
    getClosestPointToPoint = function (A, B, P) {
        var AP = new XYPoint(P.x - A.x, P.y - A.y),
            AB = new XYPoint(B.x - A.x, B.y - A.y),
            ab2 = AB.x * AB.x + AB.y * AB.y,
            ap_ab = AP.x * AB.x + AP.y * AB.y,
            t = ap_ab / ab2;

        if (t < 0.0) {
            t = 0.0;
        } else if (t > 1.0) {
            t = 1.0;
        }

        return new XYPoint(A.x + AB.x * t, A.y + AB.y * t);
    },

    /**
     * Returns the distance between two XYPoints.
     *
     * @param {XYPoint} The first point.
     * @param {XYPoint} The second point.
     * @param {Number} The distance between points one and two.
     */
    getDistanceBetweenTwoPoints = function (one, two) {
        var dx = one.x - two.x, // horizontal difference
            dy = one.y - two.y; // vertical difference

        return Math.sqrt(dx * dx + dy * dy);
    },

    /**
     * Returns an XYPoint object containing the closest available CIE 1931
     * coordinates based on the RGB input values.
     *
     * @param {Number} RGB red value, integer between 0 and 255.
     * @param {Number} RGB green value, integer between 0 and 255.
     * @param {Number} RGB blue value, integer between 0 and 255.
     * @return {XYPoint} CIE 1931 XY coordinates, corrected for reproducibility.
     */
    getXYPointFromRGB = function (red, green, blue) {

        var r = (red > 0.04045) ? Math.pow((red + 0.055) / (1.0 + 0.055), 2.4) : (red / 12.92),
            g = (green > 0.04045) ? Math.pow((green + 0.055) / (1.0 + 0.055), 2.4) : (green / 12.92),
            b = (blue > 0.04045) ? Math.pow((blue + 0.055) / (1.0 + 0.055), 2.4) : (blue / 12.92),

            X = r * 0.4360747 + g * 0.3850649 + b * 0.0930804,
            Y = r * 0.2225045 + g * 0.7168786 + b * 0.0406169,
            Z = r * 0.0139322 + g * 0.0971045 + b * 0.7141733,

            cx = X / (X + Y + Z),
            cy = Y / (X + Y + Z);

        cx = isNaN(cx) ? 0.0 : cx;
        cy = isNaN(cy) ? 0.0 : cy;

        //Check if the given XY value is within the colourreach of our lamps.
        var xyPoint = new XYPoint(cx, cy),
            inReachOfLamps = checkPointInLampsReach(xyPoint);

        if (!inReachOfLamps) {

            //Color is unreproducible, find the closest point on each line in the CIE 1931 'triangle'.
            var pAB = getClosestPointToPoint(Red, Lime, xyPoint),
                pAC = getClosestPointToPoint(Blue, Red, xyPoint),
                pBC = getClosestPointToPoint(Lime, Blue, xyPoint),

            // Get the distances per point and see which point is closer to our Point.
                dAB = getDistanceBetweenTwoPoints(xyPoint, pAB),
                dAC = getDistanceBetweenTwoPoints(xyPoint, pAC),
                dBC = getDistanceBetweenTwoPoints(xyPoint, pBC),

                lowest = dAB,
                closestPoint = pAB;

            if (dAC < lowest) {
                lowest = dAC;
                closestPoint = pAC;
            }
            if (dBC < lowest) {
                lowest = dBC;
                closestPoint = pBC;
            }

            // Change the xy value to a value which is within the reach of the lamp.
            cx = closestPoint.x;
            cy = closestPoint.y;
        }

        return new XYPoint(cx, cy);
    };

    /**
     * Publicly accessible functions exposed as API.
     */
    return {
        cie1931 : function(coordinates) {
            var i;

            if ((!util.isArray(coordinates)) || (coordinates.length != 2)) return [ 0, 0 ];
            for (i = 0; i < coordinates.length; i++) {
              if (coordinates[i] < 0) coordinates[i] = 0;
              else if (coordinates[i] > 1) coordinates[i] = 1;
            }

            return coordinates;
        },

        /**
         * Converts hexadecimal colors represented as a String to approximate
         * CIE 1931 coordinates. May not produce accurate values.
         *
         * @param {String} Value representing a hexadecimal color value
         * @return {Array{Number}} Approximate CIE 1931 x,y coordinates.
         */
        hexToCIE1931 : function (h) {
            var rgb = hexToRGB(h);
            return this.rgbToCIE1931(rgb[0], rgb[1], rgb[2]);
        },

        /**
         * Converts red, green and blue integer values to approximate CIE 1931
         * x and y coordinates. Algorithm from:
         * http://www.easyrgb.com/index.php?X=MATH&H=02#text2. May not produce
         * accurate values.
         *
         * @param {Number} red Integer in the 0-255 range.
         * @param {Number} green Integer in the 0-255 range.
         * @param {Number} blue Integer in the 0-255 range.
         * @return {Array{Number}} Approximate CIE 1931 x,y coordinates.
         */
        rgbToCIE1931 : function (red, green, blue) {
            var point = getXYPointFromRGB(red, green, blue);
            return [point.x, point.y];
        },

        /**
         * Returns the approximate CIE 1931 x,y coordinates represented by the
         * supplied hexColor parameter, or of a random color if the parameter
         * is not passed.
         *
         * @param {String} hexColor String representing a hexidecimal color value.
         * @return {Array{Number}} Approximate CIE 1931 x,y coordinates.
         */
        getCIEColor : function (hexColor /* String */) {
            var hex = hexColor || null,
                xy = [];
            if (null !== hex) {
                xy = this.hexToCIE1931(hex);
            } else {
                var r = randomRGBValue(),
                    g = randomRGBValue(),
                    b = randomRGBValue();
                xy = this.rgbToCIE1931(r, g, b);
            }
            return xy;
        },
        hexFullRed:     "FF0000",
        hexFullGreen:   "00FF00",
        hexFullBlue:    "0000FF",
        hexFullWhite:   "FFFFFF",
        hexIndigo:      "4B0082"
    };
};

exports.colors = colors();


exports.hsl2rgb = function(hsl) {
  var rgb = colorconv.hsl.rgb([ hsl.hue, hsl.saturation, hsl.brightness ]);

  return { r: rgb[0], g: rgb[1], b: rgb[2] };

// return tinycolor({ h : hsl.hue, s : hsl.saturation / 100, l : hsl.brightness / 100 }).toRgb();
};


exports.rgb2hsl = function(rgb) {
  var hsl = colorconv.rgb.hsl([ rgb.r, rgb.g, rgb.b ]);

  return { hue: hsl[0], saturation: hsl[1], brightness: hsl[2] };

//return tinycolor(rgb).toHsl();
};
