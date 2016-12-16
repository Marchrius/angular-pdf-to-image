(function(PDFJS) {
  'use strict';

  var isUndefined = angular.isUndefined,
    isDefined = angular.isDefined;

  if (isUndefined(PDFJS)) {
    throw "PDFJS not found";
  }

  var mainModule = angular.module('pdf.to.image', ['pdf.to.image.service']);
  var moduleServices = angular.module('pdf.to.image.service', []);

  moduleServices.service('pdfToImage', pdfToImageService);

  function pdfToImageService($q, $timeout) {
    var service = {
      fromUrl: fromUrl,
    }

    var defaultOptions = {
      scale: 1,
      canvas: document.createElement('canvas'),
      start: 0,
      end: -1,
      throwErrors: false,
      thumbnails: true
    }

    return service;

    function sanitizeOptions(opts) {
      opts = angular.extend(defaultOptions, opts || {});
      if (opts.scale <= 0)
        opts.scale = 1;
      if (opts.start < 0)
        opts.start = 0;
      if (opts.end < -1)
        opts.end = -1;
      opts.throwErrors = !!opts.throwErrors;
      opts.thumbnails = !!opts.thumbnails;
      return opts;
    }

    function fromUrl(url, _opts) {
      var defer = $q.defer();
      PDFJS.disableWorker = false;
      var images = [],
        opts = sanitizeOptions(_opts);
      try {
        PDFJS.getDocument(url).then(function(pdf) {
          opts.end = opts.end === -1 ? pdf.numPages : opts.end;
          opts.len = opts.end - opts.start;
          
          if (isNaN(opts.len) || opts.len < 0) {
            
            if (opts.throwErrors) throw "length cannot be negative [start:"+opts.start+":end:"+opts.end+"]";
            
            defer.reject({
              data: {
                name: "RangeError",
                message: "start cannot be greater than end [start:"+opts.start+":end:"+opts.end+"]"
              }
              
            });
          } else
          if (opts.end > pdf.numPages) {
            
            if (opts.throwErrors) throw "array index out of bounds ";
            defer.reject({
              data: {
                name: "RangeError",
                message: "array index out of bounds [start:"+opts.start+":end:"+opts.end+"]"
              }
              
            });
          } else
          if (opts.len === 0) defer.resolve({
            data: images
          });
          else {
            opts.step = opts.start;
            
            for (opts.pos = opts.start; opts.pos < opts.end; opts.pos++) {
              pdf.getPage(opts.pos + 1).then(function(page) {
                notifyProgress(defer, opts);
                renderizePage(page, opts).then(function(item) {
                  notifyProgress(defer, opts);
                  images.push(item);
                  if (images.length >= opts.len) {
                    defer.resolve({
                      data: images
                    });
                  }
                });
              });
            }
          }
        });
      } catch (ex) {
        if (opts.throwErrors) throw ex;
        defer.reject({
          data: ex
        });
      }
      return defer.promise;
    }

    function renderizePage(page, opts) {
      var renderOptions = createRenderContext(page, opts.scale);
      return page.render(renderOptions).then(function() {
        var item = {
          pageNumber: page.pageNumber,
          pageIndex: page.pageIndex,
          data: renderOptions.canvas.toDataURL()
        };
        return createThumbnailFromPage(page, item, opts);
      });
    }

    function createThumbnailFromPage(page, item, opts) {
      return $q(function(resolve, reject) {
        if (opts.thumbnails) {
          var renderOptions = createRenderContext(page, 0.25);
          page.render(renderOptions).then(function() {
            var thumb = renderOptions.canvas.toDataURL();
            item.thumbnail = thumb;
            resolve(item);
          });
        } else resolve(item);
      });
    }

    function createRenderContext(page, scale, canvas) {
      canvas = canvas || document.createElement('canvas');
      var viewport = page.getViewport(scale),
        context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      return {
        canvasContext: context,
        viewport: viewport,
        canvas: canvas
      };
    }

    function notifyProgress(defer, opts) {
      opts.step = (opts.len * 2) - opts.pos;
      var value = calculateProgress(opts.len, opts.step, 2);
      $timeout(function() {
        defer.notify({
          data: {
            min: opts.start,
            max: opts.end,
            step: opts.step,
            value: value
          }
        });
      }, 1);
    }

    function calculateProgress(end, pos, decimal, asString) {
      if (isUndefined(decimal))
        decimal = 2;
      var val = ((end - pos) / end * 100).toFixed(decimal);
      val = !asString ? val / 1 : val;
      return val;
    }

    /**
     * End module
     */
  }
})(window.PDFJS);