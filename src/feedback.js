// feedback.js
// 2013, Kázmér Rapavi, https://github.com/ivoviz/feedback
// Licensed under the MIT license.
// Version 2.0

let html2canvas = require('html2canvas/dist/html2canvas');
let utility = require('./utility');
var format = require("string-template");
let EventHandler = utility .EventHandler;
var defaultI18nProperties = require('../i18n/en.properties');

(function ($) {
    var templates = {
        highlighter: require('../templates/highlighter.html'),
        overview: require('../templates/overview.html'),
        submitSuccess: require('../templates/submitSuccess.html'),
        submitError: require('../templates/submitError.html')
    };

    var parseI18nProperties = function(i18nProperties) {
        return i18nProperties
            .split(/\r?\n/)
            .filter(line => line && !line.startsWith("#"))
            .map(line => line.split("="))
            .map(fields => [fields[0], fields.slice(1).join("=")])
            .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {});
    };

    var renderTemplate = function(template, namespace) {
        return format(template, namespace);
    }

    var showSpinner = function() {
        $("body").prepend($("<div />", {class: "feedback-spinner"}));
    };

    var hideSpinner = function() {
        $(".feedback-spinner").remove();
    };

    $.feedback = function (options) {
        var i18n = parseI18nProperties(options.i18nProperties || defaultI18nProperties);

        var settings = $.extend({
            ajaxURL: '',
            postBrowserInfo: true,
            postHTML: true,
            postURL: true,
            proxy: undefined,
            letterRendering: false,
            initButtonText: i18n.send_feedback,
            strokeStyle: 'black',
            shadowColor: 'black',
            shadowOffsetX: 1,
            shadowOffsetY: 1,
            shadowBlur: 10,
            lineJoin: 'bevel',
            lineWidth: 3,
            feedbackButton: '.feedback-btn',
            isDraggable: true,
            onScreenshotTaken: function () {
            },
            tpl: {
                highlighter: renderTemplate(templates.highlighter, i18n),
                overview: renderTemplate(templates.overview, i18n),
                submitSuccess: renderTemplate(templates.submitSuccess, i18n),
                submitError: renderTemplate(templates.submitError, i18n)
            },
            onClose: function () {
            },
            screenshotStroke: true,
            highlightElement: true,
        }, options);
        var supportedBrowser = !!window.HTMLCanvasElement;
        var isFeedbackButtonNative = settings.feedbackButton == '.feedback-btn';
        var _html2canvas = false;
        // Old code have undeclared global, ugly as hell.
        let moduleStyle, canvasAttr, _top, _left, _bottom, _right, rect, drag, highlight, post, dtype, ignore, _canvas, _ctx, canDraw;
        if (supportedBrowser) {
            if (isFeedbackButtonNative) {
                $('body').append('<button class="feedback-btn feedback-btn-gray">' + settings.initButtonText + '</button>');
            }
            $(document).on('click', settings.feedbackButton, function () {
                if (isFeedbackButtonNative) {
                    $(this).hide();
                }
                var canDraw = false,
                    img = '',
                    h = $(document).height(),
                    w = $(document).width(),
                    tpl = '<div id="feedback-module">';

                tpl +=  settings.tpl.highlighter + settings.tpl.overview + '<canvas id="feedback-canvas"></canvas><div id="feedback-helpers"></div><input id="feedback-note" name="feedback-note" type="hidden"></div>';

                $('body').append(tpl);

                let feedback_highlighter_event_handler = new EventHandler($('#feedback-highlighter').get(0));
                let feedback_highlighter_parent_event_handler = new EventHandler($('#feedback-highlighter').get(0).parentNode);

                moduleStyle = {
                    'position': 'absolute',
                    'left': '0px',
                    'top': '0px'
                };
                canvasAttr = {
                    'width': w,
                    'height': h
                };

                $('#feedback-module').css(moduleStyle);
                $('#feedback-canvas').attr(canvasAttr).css('z-index', '30000');

                $('#feedback-highlighter-back').remove();
                canDraw = true;
                $('#feedback-canvas').css('cursor', 'crosshair');
                $('#feedback-helpers').show();
                $('#feedback-welcome').hide();
                $('#feedback-highlighter').show();

                if (settings.isDraggable) {
                    let feedback_highlighter_move_handler = null;
                    feedback_highlighter_event_handler.on_pointer_events(e => {
                        let point = e.touches ? e.touches[0] : e;
                        var $d = $("#feedback-highlighter").addClass('feedback-draggable'),
                            drag_h = $d.outerHeight(),
                            drag_w = $d.outerWidth(),
                            pos_y = $d.offset().top + drag_h - point.pageY,
                            pos_x = $d.offset().left + drag_w - point.pageX;
                        $d.css('z-index', 40000);

                        feedback_highlighter_move_handler = function (e) {
                            let point = e.touches ? e.touches[0] : e;
                            _top = point.pageY + pos_y - drag_h;
                            _left = point.pageX + pos_x - drag_w;
                            _bottom = drag_h - point.pageY;
                            _right = drag_w - point.pageX;

                            if (_left < 0) _left = 0;
                            if (_top < 0) _top = 0;
                            if (_right > $(window).width())
                                _left = $(window).width() - drag_w;
                            if (_left > $(window).width() - drag_w)
                                _left = $(window).width() - drag_w;
                            if (_bottom > $(document).height())
                                _top = $(document).height() - drag_h;
                            if (_top > $(document).height() - drag_h)
                                _top = $(document).height() - drag_h;

                            $('.feedback-draggable').offset({
                                top: _top,
                                left: _left
                            }).on("mouseup", function () {
                                $(this).removeClass('feedback-draggable');
                            });
                        };

                        feedback_highlighter_parent_event_handler.on_pointer_events(feedback_highlighter_move_handler, 'move');
                        e.preventDefault();
                    }, 'down').on_pointer_events(e => {
                        $("#feedback-highlighter").removeClass('feedback-draggable');
                        feedback_highlighter_parent_event_handler.off_pointer_events(feedback_highlighter_move_handler, 'move');
                    }, 'up');
                }

                var ctx = $('#feedback-canvas')[0].getContext('2d');

                ctx.fillStyle = 'rgba(102,102,102,0.5)';
                ctx.fillRect(0, 0, $('#feedback-canvas').width(), $('#feedback-canvas').height());

                rect = {};
                drag = false;
                highlight = 1,
                    post = {};

                if (settings.postBrowserInfo) {
                    post.browser = {};
                    post.browser.appCodeName = navigator.appCodeName;
                    post.browser.appName = navigator.appName;
                    post.browser.appVersion = navigator.appVersion;
                    post.browser.cookieEnabled = navigator.cookieEnabled;
                    post.browser.onLine = navigator.onLine;
                    post.browser.platform = navigator.platform;
                    post.browser.userAgent = navigator.userAgent;
                    post.browser.plugins = [];

                    $.each(navigator.plugins, function (i) {
                        post.browser.plugins.push(navigator.plugins[i].name);
                    });
                    $('#feedback-browser-info').show();
                }

                if (settings.postURL) {
                    post.url = document.URL;
                    $('#feedback-page-info').show();
                }

                if (settings.postHTML) {
                    post.html = $('html').html();
                    $('#feedback-page-structure').show();
                }

                if (!settings.postBrowserInfo && !settings.postURL && !settings.postHTML)
                    $('#feedback-additional-none').show();

                $(document).on('mousedown', '#feedback-canvas', function (e) {
                    if (canDraw) {

                        rect.startX = e.pageX - $(this).offset().left;
                        rect.startY = e.pageY - $(this).offset().top;
                        rect.w = 0;
                        rect.h = 0;
                        drag = true;
                    }
                });

                $(document).on('mouseup', function () {
                    if (canDraw) {
                        drag = false;

                        var dtop = rect.startY,
                            dleft = rect.startX,
                            dwidth = rect.w,
                            dheight = rect.h;
                        dtype = 'highlight';

                        if (dwidth == 0 || dheight == 0) return;

                        if (dwidth < 0) {
                            dleft += dwidth;
                            dwidth *= -1;
                        }
                        if (dheight < 0) {
                            dtop += dheight;
                            dheight *= -1;
                        }

                        if (dtop + dheight > $(document).height())
                            dheight = $(document).height() - dtop;
                        if (dleft + dwidth > $(document).width())
                            dwidth = $(document).width() - dleft;

                        if (highlight == 0)
                            dtype = 'blackout';

                        $('#feedback-helpers').append('<div class="feedback-helper" data-type="' + dtype + '" data-time="' + Date.now() + '" style="position:absolute;top:' + dtop + 'px;left:' + dleft + 'px;width:' + dwidth + 'px;height:' + dheight + 'px;z-index:30000;"></div>');

                        redraw(ctx);
                        rect.w = 0;
                    }

                });

                $(document).on('mousemove', function (e) {
                    if (canDraw && drag) {
                        $('#feedback-highlighter').css('cursor', 'default');

                        rect.w = (e.pageX - $('#feedback-canvas').offset().left) - rect.startX;
                        rect.h = (e.pageY - $('#feedback-canvas').offset().top) - rect.startY;

                        ctx.clearRect(0, 0, $('#feedback-canvas').width(), $('#feedback-canvas').height());
                        ctx.fillStyle = 'rgba(102,102,102,0.5)';
                        ctx.fillRect(0, 0, $('#feedback-canvas').width(), $('#feedback-canvas').height());
                        $('.feedback-helper').each(function () {
                            if ($(this).attr('data-type') == 'highlight')
                                drawlines(ctx, parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height());
                        });
                        if (highlight == 1) {
                            drawlines(ctx, rect.startX, rect.startY, rect.w, rect.h);
                            ctx.clearRect(rect.startX, rect.startY, rect.w, rect.h);
                        }
                        $('.feedback-helper').each(function () {
                            if ($(this).attr('data-type') == 'highlight')
                                ctx.clearRect(parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height());
                        });
                        $('.feedback-helper').each(function () {
                            if ($(this).attr('data-type') == 'blackout') {
                                ctx.fillStyle = 'rgba(0,0,0,1)';
                                ctx.fillRect(parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height())
                            }
                        });
                        if (highlight == 0) {
                            ctx.fillStyle = 'rgba(0,0,0,0.5)';
                            ctx.fillRect(rect.startX, rect.startY, rect.w, rect.h);
                        }
                    }
                });

                if (settings.highlightElement) {
                    var highlighted = [],
                        tmpHighlighted = [],
                        hidx = 0;

                    $(document).on('mousemove click', '#feedback-canvas', function (e) {
                        if (canDraw) {
                            redraw(ctx);
                            tmpHighlighted = [];

                            $('#feedback-canvas').css('cursor', 'crosshair');

                            $('* :not(body,script,iframe,div,section,.feedback-btn,#feedback-module *)').each(function () {
                                if ($(this).attr('data-highlighted') === 'true')
                                    return;

                                if (e.pageX > $(this).offset().left && e.pageX < $(this).offset().left + $(this).width() && e.pageY > $(this).offset().top + parseInt($(this).css('padding-top'), 10) && e.pageY < $(this).offset().top + $(this).height() + parseInt($(this).css('padding-top'), 10)) {
                                    tmpHighlighted.push($(this));
                                }
                            });

                            var $toHighlight = tmpHighlighted[tmpHighlighted.length - 1];

                            if ($toHighlight && !drag) {
                                $('#feedback-canvas').css('cursor', 'pointer');

                                var _x = $toHighlight.offset().left - 2,
                                    _y = $toHighlight.offset().top - 2,
                                    _w = $toHighlight.width() + parseInt($toHighlight.css('padding-left'), 10) + parseInt($toHighlight.css('padding-right'), 10) + 6,
                                    _h = $toHighlight.height() + parseInt($toHighlight.css('padding-top'), 10) + parseInt($toHighlight.css('padding-bottom'), 10) + 6;

                                if (highlight == 1) {
                                    drawlines(ctx, _x, _y, _w, _h);
                                    ctx.clearRect(_x, _y, _w, _h);
                                    dtype = 'highlight';
                                }

                                $('.feedback-helper').each(function () {
                                    if ($(this).attr('data-type') == 'highlight')
                                        ctx.clearRect(parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height());
                                });

                                if (highlight == 0) {
                                    dtype = 'blackout';
                                    ctx.fillStyle = 'rgba(0,0,0,0.5)';
                                    ctx.fillRect(_x, _y, _w, _h);
                                }

                                $('.feedback-helper').each(function () {
                                    if ($(this).attr('data-type') == 'blackout') {
                                        ctx.fillStyle = 'rgba(0,0,0,1)';
                                        ctx.fillRect(parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height());
                                    }
                                });

                                if (e.type == 'click' && Math.round(e.pageX) == Math.round(rect.startX) && Math.round(e.pageY) == Math.round(rect.startY)) {
                                    $('#feedback-helpers').append('<div class="feedback-helper" data-highlight-id="' + hidx + '" data-type="' + dtype + '" data-time="' + Date.now() + '" style="position:absolute;top:' + _y + 'px;left:' + _x + 'px;width:' + _w + 'px;height:' + _h + 'px;z-index:30000;"></div>');
                                    highlighted.push(hidx);
                                    ++hidx;
                                    redraw(ctx);
                                }
                            }
                        }
                    });
                }

                $(document).on('mouseleave', 'body,#feedback-canvas', function () {
                    redraw(ctx);
                });

                $(document).on('mouseenter', '.feedback-helper', function () {
                    redraw(ctx);
                });

                $(document).on('click', '#feedback-welcome-next', function () {
                    if ($('#feedback-note').val().length > 0) {
                        canDraw = true;
                        $('#feedback-canvas').css('cursor', 'crosshair');
                        $('#feedback-helpers').show();
                        $('#feedback-welcome').hide();
                        $('#feedback-highlighter').show();
                    }
                    else {
                        $('#feedback-welcome-error').show();
                    }
                });

                $(document).on('mouseenter mouseleave', '.feedback-helper', function (e) {
                    if (drag)
                        return;

                    rect.w = 0;
                    rect.h = 0;

                    if (e.type === 'mouseenter') {
                        $(this).css('z-index', '30001');
                        $(this).append('<div class="feedback-helper-inner" style="width:' + ($(this).width() - 2) + 'px;height:' + ($(this).height() - 2) + 'px;position:absolute;margin:1px;"></div>');
                        $(this).append('<div id="feedback-close"></div>');
                        $(this).find('#feedback-close').css({
                            'top': -1 * ($(this).find('#feedback-close').height() / 2) + 'px',
                            'left': $(this).width() - ($(this).find('#feedback-close').width() / 2) + 'px'
                        });

                        if ($(this).attr('data-type') == 'blackout') {
                            /* redraw white */
                            ctx.clearRect(0, 0, $('#feedback-canvas').width(), $('#feedback-canvas').height());
                            ctx.fillStyle = 'rgba(102,102,102,0.5)';
                            ctx.fillRect(0, 0, $('#feedback-canvas').width(), $('#feedback-canvas').height());
                            $('.feedback-helper').each(function () {
                                if ($(this).attr('data-type') == 'highlight')
                                    drawlines(ctx, parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height());
                            });
                            $('.feedback-helper').each(function () {
                                if ($(this).attr('data-type') == 'highlight')
                                    ctx.clearRect(parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height());
                            });

                            ctx.clearRect(parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height())
                            ctx.fillStyle = 'rgba(0,0,0,0.75)';
                            ctx.fillRect(parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height());

                            ignore = $(this).attr('data-time');

                            /* redraw black */
                            $('.feedback-helper').each(function () {
                                if ($(this).attr('data-time') == ignore)
                                    return true;
                                if ($(this).attr('data-type') == 'blackout') {
                                    ctx.fillStyle = 'rgba(0,0,0,1)';
                                    ctx.fillRect(parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height())
                                }
                            });
                        }
                    }
                    else {
                        $(this).css('z-index', '30000');
                        $(this).children().remove();
                        if ($(this).attr('data-type') == 'blackout') {
                            redraw(ctx);
                        }
                    }
                });

                $(document).on('click', '#feedback-close', function () {
                    if (settings.highlightElement && $(this).parent().attr('data-highlight-id'))
                        var _hidx = $(this).parent().attr('data-highlight-id');

                    $(this).parent().remove();

                    if (settings.highlightElement && _hidx)
                        $('[data-highlight-id="' + _hidx + '"]').removeAttr('data-highlighted').removeAttr('data-highlight-id');

                    redraw(ctx);
                });

                $('#feedback-module').on('click', '.feedback-wizard-close,.feedback-close-btn', function () {
                    close();
                });

                $(document).on('keyup', function (e) {
                    if (e.keyCode == 27)
                        close();
                });

                $(document).on('selectstart dragstart', document, function (e) {
                    e.preventDefault();
                });

                $(document).on('click', '#feedback-highlighter-back', function () {
                    canDraw = false;
                    $('#feedback-canvas').css('cursor', 'default');
                    $('#feedback-helpers').hide();
                    $('#feedback-highlighter').hide();
                    $('#feedback-welcome-error').hide();
                    $('#feedback-welcome').show();
                });

                $(document).on('click', '.feedback-sethighlight', function () {
                    highlight = 1;
                    $(this).addClass('feedback-active');
                    $('.feedback-setblackout').removeClass('feedback-active');
                });

                $(document).on('click', '.feedback-setblackout', function () {
                    highlight = 0;
                    $(this).addClass('feedback-active');
                    $('.feedback-sethighlight').removeClass('feedback-active');
                });

                $(document).on('click', '#feedback-highlighter-next', function () {
                    canDraw = false;
                    $('#feedback-canvas').css('cursor', 'default');
                    var sy = $(document).scrollTop(),
                        dh = $(window).height();
                    $('#feedback-helpers').hide();
                    $('#feedback-highlighter').hide();
                    showSpinner();
                    if (!settings.screenshotStroke) {
                        redraw(ctx, false);
                    }
                    html2canvas($('body').get(0)).then(
                        function (canvas) {
                            hideSpinner();
                            if (!settings.screenshotStroke) {
                                redraw(ctx);
                            }
                            _canvas = $('<canvas id="feedback-canvas-tmp" width="' + w + '" height="' + dh + '"/>').hide().appendTo('body');
                            _ctx = _canvas.get(0).getContext('2d');
                            _ctx.drawImage(canvas, 0, sy, w, dh, 0, 0, w, dh);
                            img = _canvas.get(0).toDataURL();
                            $(document).scrollTop(sy);
                            post.img = img;
                            settings.onScreenshotTaken(post.img);
                            $('#feedback-canvas-tmp').remove();
                            $('#feedback-overview').show();
                            if (!utility.isMobile) {
                                $('#feedback-overview').toggleClass('feedback-desktop', true);
                                $('#feedback-overview').toggleClass('feedback-mobile', false);
                            } else {
                                $('#feedback-overview').toggleClass('feedback-desktop', false);
                                $('#feedback-overview').toggleClass('feedback-mobile', true);
                            }
                            $('#feedback-overview-screenshot>img').remove();
                            $('#feedback-overview-screenshot').append('<img class="feedback-screenshot" src="' + img + '" />');
                        }
                    );
                });

                $(document).on('click', '#feedback-overview-back', function (e) {
                    canDraw = true;
                    $('#feedback-canvas').css('cursor', 'crosshair');
                    $('#feedback-overview').hide();
                    $('#feedback-helpers').show();
                    $('#feedback-highlighter').show();
                    $('#feedback-overview-error').hide();
                });

                $(document).on('click', '#feedback-submit', function () {
                    canDraw = false;

                    if ($('#feedback-title').val().length > 0 && $('#feedback-note').val().length > 0) {
                        $('#feedback-submit-success,#feedback-submit-error').remove();
                        $('#feedback-overview').hide();

                        post.img = img;
                        post.title = $('#feedback-title').val();
                        post.note = $('#feedback-note').val();
                        var data = {feedback: JSON.stringify(post)};
                        showSpinner();
                        (settings.postFunction || $.ajax)({
                            url: settings.ajaxURL,
                            dataType: 'json',
                            type: 'POST',
                            data: data,
                            post: post,
                            success: function () {
                                hideSpinner();
                                $('#feedback-module').append(settings.tpl.submitSuccess);
                            },
                            error: function () {
                                hideSpinner();
                                $('#feedback-module').append(settings.tpl.submitError);
                            }
                        });
                    }
                    else {
                        $('#feedback-overview-error').show();
                    }
                });
            });
        }

        function close() {
            canDraw = false;
            $(document).off('mouseenter mouseleave', '.feedback-helper');
            $(document).off('mouseup keyup');
            $(document).off('mousedown', '.feedback-setblackout');
            $(document).off('mousedown', '.feedback-sethighlight');
            $(document).off('mousedown click', '#feedback-close');
            $(document).off('mousedown', '#feedback-canvas');
            $(document).off('click', '#feedback-highlighter-next');
            $(document).off('click', '#feedback-highlighter-back');
            $(document).off('click', '#feedback-welcome-next');
            $(document).off('click', '#feedback-overview-back');
            $(document).off('mouseleave', 'body');
            $(document).off('mouseenter', '.feedback-helper');
            $(document).off('selectstart dragstart', document);
            $('#feedback-module').off('click', '.feedback-wizard-close,.feedback-close-btn');
            $(document).off('click', '#feedback-submit');

            if (settings.highlightElement) {
                $(document).off('click', '#feedback-canvas');
                $(document).off('mousemove', '#feedback-canvas');
            }
            $('[data-highlighted="true"]').removeAttr('data-highlight-id').removeAttr('data-highlighted');
            $('#feedback-module').remove();
            $('.feedback-btn').show();

            settings.onClose.call(this);
        }

        function redraw(ctx, border) {
            border = typeof border !== 'undefined' ? border : true;
            ctx.clearRect(0, 0, $('#feedback-canvas').width(), $('#feedback-canvas').height());
            ctx.fillStyle = 'rgba(102,102,102,0.5)';
            ctx.fillRect(0, 0, $('#feedback-canvas').width(), $('#feedback-canvas').height());
            $('.feedback-helper').each(function () {
                if ($(this).attr('data-type') == 'highlight')
                    if (border)
                        drawlines(ctx, parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height());
            });
            $('.feedback-helper').each(function () {
                if ($(this).attr('data-type') == 'highlight')
                    ctx.clearRect(parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height());
            });
            $('.feedback-helper').each(function () {
                if ($(this).attr('data-type') == 'blackout') {
                    ctx.fillStyle = 'rgba(0,0,0,1)';
                    ctx.fillRect(parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height());
                }
            });
        }

        function drawlines(ctx, x, y, w, h) {
            ctx.strokeStyle = settings.strokeStyle;
            ctx.shadowColor = settings.shadowColor;
            ctx.shadowOffsetX = settings.shadowOffsetX;
            ctx.shadowOffsetY = settings.shadowOffsetY;
            ctx.shadowBlur = settings.shadowBlur;
            ctx.lineJoin = settings.lineJoin;
            ctx.lineWidth = settings.lineWidth;

            ctx.strokeRect(x, y, w, h);

            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.shadowBlur = 0;
            ctx.lineWidth = 1;
        }

    };

}(jQuery));
