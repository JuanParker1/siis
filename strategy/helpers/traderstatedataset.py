# @date 2018-08-24
# @author Frederic Scherma, All rights reserved without prejudices.
# @license Copyright (c) 2018 Dream Overflow
# Strategy helper to get dataset

import traceback

import logging
logger = logging.getLogger('siis.strategy')
error_logger = logging.getLogger('siis.error.strategy')
traceback_logger = logging.getLogger('siis.traceback.strategy')


def get_strategy_trader_state(strategy, market_id: str, report_mode: int = 0):
    """
    Generate and return an array of all the actives trades :
        symbol: str market identifier
    """
    results = {
        'market-id': market_id,
        'activity': False,
        'bootstrapping': False,
        'ready': False,
        'members': [],
        'data': [],
        'num-modes': 1
    }

    trader = strategy.trader()

    with strategy.mutex:
        try:
            strategy_trader = strategy.strategy_traders.get(market_id)
            if strategy_trader:
                with strategy_trader.mutex:
                    results = strategy_trader.report_state(report_mode)

        except Exception as e:
            error_logger.error(repr(e))
            traceback_logger.error(traceback.format_exc())

    return results
