/**
 * @date 2020-01-24
 * @author Frederic Scherma, All rights reserved without prejudices.
 * @license Copyright (c) 2020 Dream Overflow
 * Web trader signal handler.
 */

function on_strategy_signal(market_id, signal_id, timestamp, signal, do_notify=true) {
    if (signal_id > 0) {
        // get only pure signal (not related to a trade)
        return;
    }

    let signal_elt = $('<tr class="signal"></tr>');
    let key = market_id + ':' + signal.timestamp;
    signal_elt.attr('signal-key', key);

    // let lsignal_id = $('<span class="signal-id"></span>').text(signal.id);
    let signal_symbol = $('<span class="signal-symbol"></span>').text(market_id);
    let signal_direction = $('<span class="signal-direction fa"></span>')
        .addClass(signal.direction == "long" ? 'trade-long' : 'trade-short')
        .addClass(signal.direction == "long" ? 'fa-arrow-up' : 'fa-arrow-down');

    let signal_way = $('<span class="signal-way fa"></span>')
        .addClass(signal.way == "entry" ? 'signal-entry' : 'signal-exit')
        .addClass(signal.way == "entry" ? 'fa-arrow-right' : 'fa-arrow-left');

    let signal_datetime = $('<span class="signal-datetime"></span>').text(timestamp_to_datetime_str(signal.timestamp));

    let signal_order = $('<span class="signal-order"></span>').text(signal['order-type'] + '@' + format_price(market_id, signal['order-price']));
    let signal_exit = $('<span class="signal-exit"></span>').text(signal.timeframe || "trade");

    let signal_context = $('<span class="signal-timeframe"></span>').text(signal.label + ' (' + signal.timeframe + ')');

    let signal_stop_loss = $('<span class="signal-stop-loss"></span>').text(format_price(market_id, signal['stop-loss-price']));
    let signal_take_profit = $('<span class="signal-take-profit"></span>').text(format_price(market_id, signal['take-profit-price']));

    let signal_reason = $('<span class="signal-reason"></span>').text(signal.reason);

    let pnl = compute_price_pct(signal['take-profit-price'], signal['order-price'], signal.direction == "long" ? 1 : -1);
    let signal_percent = $('<span class="signal-percent"></span>').text((pnl * 100).toFixed(2) + '%');

    let signal_copy = $('<button class="signal-copy btn btn-info fas fa-copy"></button>');

    // signal_elt.append($('<td></td>').append(lsignal_id));
    signal_elt.append($('<td></td>').append(signal_symbol));
    signal_elt.append($('<td></td>').append(signal_direction));
    signal_elt.append($('<td></td>').append(signal_way));
    signal_elt.append($('<td></td>').append(signal_datetime));
    signal_elt.append($('<td></td>').append(signal_order));
    signal_elt.append($('<td></td>').append(signal_context));
    signal_elt.append($('<td></td>').append(signal_stop_loss));
    signal_elt.append($('<td></td>').append(signal_take_profit));
    signal_elt.append($('<td></td>').append(signal_reason));
    signal_elt.append($('<td></td>').append(signal_percent));
    signal_elt.append($('<td></td>').append(signal_copy));

    // append
    $('div.signal-list-entries tbody').prepend(signal_elt);

    signal_copy.on('click', on_copy_signal);

    window.signals[key] = signal;

    if (do_notify) {
        let message = signal.label + " "  + (signal.reason || signal.way) + " " + signal.direction + " " +
            signal.symbol + " @" + format_price(market_id, signal['order-price']);
        notify({'message': message, 'title': 'Trade Signal', 'type': 'info'});
        audio_notify('signal');
    }

    // limit to last 200 signals
    if ($('div.signal-list-entries tbody').children('tr').length > 200) {
        let older = $('div.signal-list-entries tbody').children('tr:last');
        let older_key = older.attr('signal-key');

        older.remove();
        delete window.signals[older_key];
    }
}

function on_copy_signal(elt) {
    // @todo quantity rate, risk:reward, capital risk %/$
    let key = retrieve_signal_key(elt);
    $('#copy_signal').attr('signal-key', key);

    let signal = window.signals[key];
    if (!signal) {
        return;
    }

    let market_id = signal['market-id'];
    let market = window.markets[market_id];
    if (!market) {
        return;
    }

    let direction = signal.direction == "long" ? 1 : -1;

    // only copy entry signals
    if (signal.way != "entry") {
        return;
    }

    if (elt.ctrlKey) {
        // direct copy (no modal window)
        let second_take_profit = 0.0;
        let third_take_profit = 0.0;

        if ('second-take-profit-price' in signal) {
            second_take_profit = parseFloat(signal['second-take-profit-price']);
        }
        if ('third-take-profit-price' in signal) {
            third_take_profit = parseFloat(signal['third-take-profit-price']);
        }

        let trigger_price = 0.0;
        let limit_price = 0.0;
        let method = 'market';

        if (signal['order-price'] > 0.0) {
            limit_price = parseFloat(signal['order-price']);
            method = 'limit';
        }

        let quantity_rate = 1.0;
        let user_quantity = 0.0;
        let entry_timeout = 0.0;
        let leverage = 1.0;

        let take_profit = parseFloat(signal['take-profit-price']);
        let stop_loss = parseFloat(signal['stop-loss-price']);

        let data = {
            'command': 'trade-entry',
            'market-id': market_id,
            'direction': direction,
            'limit-price': limit_price,
            'trigger-price': trigger_price,
            'method': method,
            'entry-timeout': entry_timeout,
            'leverage': leverage
        };

        if (user_quantity > 0.0) {
            data['user-quantity'] = user_quantity;
        } else {
            data['quantity-rate'] = quantity_rate;
        }

        if (stop_loss > 0.0) {
            data['stop-loss'] = stop_loss;
            data['stop-loss-price-mode'] = 'price';
        }

        if (take_profit > 0.0) {
            data['take-profit'] = take_profit;
            data['take-profit-price-mode'] = 'price';
        }

        let market = window.markets[market_id];
        if (!market) {
            return;
        }

        let profile_name = signal.context;
        let profile = market.profiles[profile_name];

        let context = profile_name;
        let timeframe = signal.timeframe;

        if (context && profile && ('strategy' in profile)) {
            data['context'] = context;
        } else if (timeframe) {
            data['timeframe'] = timeframe;
        }

        if (second_take_profit > 0.0) {
            data['second-take-profit'] = second_take_profit;
        }

        if (third_take_profit > 0.0) {
            data['third-take-profit'] = third_take_profit;
        }

        let endpoint = "strategy/trade";
        let url = base_url() + '/' + endpoint;
        let title = direction > 0 ? 'Order Long' : 'Order Short';

        $.ajax({
            type: "POST",
            url: url,
            headers: {
                'Authorization': "Bearer " + server['auth-token'],
                'TWISTED_SESSION': server.session,
            },
            data: JSON.stringify(data),
            dataType: 'json',
            contentType: 'application/json'
        })
        .done(function(data) {
            if (data.error) {
                for (let msg in data.messages) {
                    notify({'message': data.messages[msg], 'title': title, 'type': 'error'});
                }
            } else {
                notify({'message': "Success", 'title': title, 'type': 'success'});
            }
        })
        .fail(function(data) {
            for (let msg in data.messages) {
                notify({'message': msg, 'title': title, 'type': 'error'});
            }
        });
    } else {
        // setup modal dialog and events
        if (direction > 0) {
            $("#copy_signal").find(".modal-title").text("Copy Signal - Open Long on " + market.symbol);
            $("#copy_signal_open").text("Long");
            $("#copy_signal_open").removeClass("btn-danger").addClass("btn-success");
        } else {
            $("#copy_signal").find(".modal-title").text("Copy Signal - Open Short on " + market.symbol);
            $("#copy_signal_open").text("Short");
            $("#copy_signal_open").removeClass("btn-success").addClass("btn-danger");
        }

        if (signal['label'] && signal['timeframe']) {
            $('#copy_signal_context').val(signal['label'] + ' (' + signal['timeframe'] + ')');
        } else {
            $('#copy_signal_context').val(signal['label'] || signal['timeframe']);
        }

        if (signal['order-price'] > 0.0) {
            $('#copy_signal_order_price').attr('type', "number").val(parseFloat(signal['order-price']));
        } else {
            $('#copy_signal_order_price').attr('type', "text").val("Market");
        }

        $('#copy_signal_take_profit_price').val(parseFloat(signal['take-profit-price']));
        $('#copy_signal_take_profit_range').slider('setValue', 50);
        $('#copy_signal_take_profit_type').selectpicker('val', 'percent').change();

        $('#copy_signal_stop_loss_price').val(parseFloat(signal['stop-loss-price']));
        $('#copy_signal_stop_loss_range').slider('setValue', 50);
        $('#copy_signal_stop_loss_type').selectpicker('val', 'percent').change();

        /*$('#copy_signal_second_take_profit_price').val(parseFloat(signal['second-take-profit-price']));
        $('#copy_signal_second_take_profit_range').slider('setValue', 50);
        $('#copy_signal_second_take_profit_type').selectpicker('val', 'percent').change();

        $('#copy_signal_third_take_profit_price').val(parseFloat(signal['third-take-profit-price']));
        $('#copy_signal_third_take_profit_range').slider('setValue', 50);
        $('#copy_signal_third_take_profit_type').selectpicker('val', 'percent').change();*/

        $('#copy_signal_comment').val("");

        $('#copy_signal').modal({'show': true, 'backdrop': true});

        $('#copy_signal_open').off('click');
        $('#copy_signal_open').on('click', function(e) {
            let comment = $('#copy_signal_comment').val();

            let second_take_profit = 0.0;
            let third_take_profit = 0.0;

            /*if ($('#copy_signal_second_take_profit_price').val()) {
                second_take_profit = parseFloat($('#copy_signal_second_take_profit_price').val());
            }
            if ($('#copy_signal_third_take_profit_price').val()) {
                third_take_profit = parseFloat($('#copy_signal_third_take_profit_price').val());
            }*/

            let trigger_price = 0.0;
            let limit_price = 0.0;
            let method = 'market';

            if ($('#copy_signal_order_price').attr('type') == "text" && $('#copy_signal_order_price').val() == "Market") {
                limit_price = 0.0;
                method = 'market';
            } else {
                limit_price = parseFloat($('#copy_signal_order_price').val());
                method = 'limit';
            }

            let quantity_rate = 1.0;
            let user_quantity = 0.0;
            let entry_timeout = 0.0;
            let leverage = 1.0;

            let take_profit = parseFloat($('#copy_signal_take_profit_price').val());
            let stop_loss = parseFloat($('#copy_signal_stop_loss_price').val());

            let data = {
                'command': 'trade-entry',
                'market-id': market_id,
                'direction': direction,
                'limit-price': limit_price,
                'trigger-price': trigger_price,
                'method': method,
                'entry-timeout': entry_timeout,
                'leverage': leverage
            };

            if (user_quantity > 0.0) {
                data['user-quantity'] = user_quantity;
            } else {
                data['quantity-rate'] = quantity_rate;
            }

            if (stop_loss > 0.0) {
                data['stop-loss'] = stop_loss;
                data['stop-loss-price-mode'] = 'price';
            }

            if (take_profit > 0.0) {
                data['take-profit'] = take_profit;
                data['take-profit-price-mode'] = 'price';
            }

            let market = window.markets[market_id];
            if (!market) {
                return;
            }

            let profile_name = signal.context;
            let profile = market.profiles[profile_name];

            let context = profile_name;
            let timeframe = signal.timeframe;

            if (context && profile && ('strategy' in profile)) {
                data['context'] = context;
            } else if (timeframe) {
                data['timeframe'] = timeframe;
            }

            if (comment) {
                data['comment'] = comment;
            }

            if (second_take_profit > 0.0) {
                data['second-take-profit'] = second_take_profit;
            }

            if (third_take_profit > 0.0) {
                data['third-take-profit'] = third_take_profit;
            }

            let endpoint = "strategy/trade";
            let url = base_url() + '/' + endpoint;
            let title = direction > 0 ? 'Order Long' : 'Order Short';

            $.ajax({
                type: "POST",
                url: url,
                headers: {
                    'Authorization': "Bearer " + server['auth-token'],
                    'TWISTED_SESSION': server.session,
                },
                data: JSON.stringify(data),
                dataType: 'json',
                contentType: 'application/json'
            })
            .done(function(data) {
                if (data.error) {
                    for (let msg in data.messages) {
                        notify({'message': data.messages[msg], 'title': title, 'type': 'error'});
                    }
                } else {
                    notify({'message': "Success", 'title': title, 'type': 'success'});
                }
            })
            .fail(function(data) {
                for (let msg in data.messages) {
                    notify({'message': msg, 'title': title, 'type': 'error'});
                }
            });
        });
    }
}

function on_change_copy_signal_take_profit_step() {
    let key = $('#copy_signal').attr('signal-key');

    let signal = window.signals[key];
    let take_profit_price = $('#copy_signal_take_profit_price').val();

    let mode = $('#copy_signal_take_profit_type').val();
    let range = parseFloat($('#copy_signal_take_profit_range').val());

    if (mode == 'percent') {
        range = (range - 50) * 0.001;

        take_profit_price = format_price(signal['market-id'],
            parseFloat(signal['take-profit-price']) * (1.0 + range));

        $('#copy_signal_take_profit_range_relative').text((range*100).toFixed(2) + "%");
    } else if (mode == 'pip') {
        range = (range - 50);
        let value_per_pip = window.markets[signal['market-id']]['value-per-pip'];

        take_profit_price = format_price(signal['market-id'],
            parseFloat(signal['take-profit-price']) + value_per_pip * range);

        $('#copy_signal_take_profit_range_relative').text(range + "pips");
    }

    $('#copy_signal_take_profit_price').val(take_profit_price);
}

function on_change_copy_signal_stop_loss_step() {
    let key = $('#copy_signal').attr('signal-key');

    let signal = window.signals[key];
    let stop_loss_price = $('#copy_signal_stop_loss_price').val();

    let mode = $('#copy_signal_stop_loss_type').val();
    let range = parseFloat($('#copy_signal_stop_loss_range').val());

    if (mode == 'percent') {
        range = (range - 50) * 0.001;

        stop_loss_price = format_price(signal['market-id'],
            parseFloat(signal['stop-loss-price']) * (1.0 + range));

        $('#copy_signal_stop_loss_range_relative').text((range*100).toFixed(2) + "%");
    } else if (mode == 'pip') {
        range = (range - 50);
        let value_per_pip = window.markets[signal['market-id']]['value-per-pip'];

        stop_loss_price = format_price(signal['market-id'],
            parseFloat(signal['stop-loss-price']) + value_per_pip * range);

        $('#copy_signal_stop_loss_range_relative').text(range + "pips");
    }

    $('#copy_signal_stop_loss_price').val(stop_loss_price);
}

$(window).ready(function() {
    $('#copy_signal_stop_loss_range').slider({
        'min': 0,
        'max': 100,
        'step': 1,
        'value': 50,
    }).on('change', function(elt) {
        on_change_copy_signal_stop_loss_step();
    });

    $('#copy_signal_stop_loss_type').selectpicker({'width': '75px', 'size': '10'
    }).on('change', function(elt) {
        $('#copy_signal_stop_loss_range').slider('setValue', 50);
        on_change_copy_signal_stop_loss_step();
    });

    $('#copy_signal_take_profit_range').slider({
        'min': 0,
        'max': 100,
        'step': 1,
        'value': 50,
    }).on('change', function(elt) {
        on_change_copy_signal_take_profit_step();
    });

    $('#copy_signal_take_profit_type').selectpicker({'width': '75px', 'size': '10'
    }).on('change', function(elt) {
        $('#copy_signal_take_profit_range').slider('setValue', 50);
        on_change_copy_signal_take_profit_step();
    });
});

window.fetch_signals = function() {
    // fetch last signal history
    let endpoint = "strategy/historical-signal";
    let url = base_url() + '/' + endpoint;

    let params = {}

    $.ajax({
        type: "GET",
        url: url,
        data: params,
        headers: {
            'TWISTED_SESSION': server.session,
            'Authorization': "Bearer " + server['auth-token'],
        },
        dataType: 'json',
        contentType: 'application/json'
    })
    .done(function(result) {
        window.signals = {};

        let signals = result['data'];

        // naturally ordered
        for (let i = 0; i < signals.length; ++i) {
            let signal = signals[i];
            if (signal.id > 0) {
                // get only pure signal (not related to a trade)
                continue;
            }

            window.signals[signal['market-id'] + ':' + signal.timestamp] = signal;

            // initial add
            on_strategy_signal(signal['market-id'], signal.id, signal.timestamp, signal, false);
        }
    })
    .fail(function() {
        notify({'message': "Unable to obtains historical signals !", 'title': 'fetching"', 'type': 'error'});
    });
};
