# @date 2019-06-28
# @author Frederic SCHERMA
# @license Copyright (c) 2019 Dream Overflow
# Active trades view.

from terminal.terminal import Terminal
from view.tableview import TableView


class TradeView(TableView):
    """
    Active trade view.
    """

    def __init__(self, strategy_service):
        super().__init__("strategy")

        self._strategy_service = strategy_service

    def refresh(self):
        if not self._strategy_service:
            return

        appliances = self._strategy_service.get_appliances()
        if len(appliances) > 0 and -1 < self._item < len(appliances):
            appliance = appliances[self._item]
            num = 0

            try:
                columns, table, total_size = appliance.trades_stats_table(*self.table_format(), quantities=True, percents=self._percent)
                self.table(columns, table, total_size)
                num = total_size[1]
            except Exception as e:
                print(e)
                pass

            self.set_title("Active trades (%i) for strategy %s - %s" % (num, appliance.name, appliance.identifier))
        else:
            self.set_title("Active trades - No configured strategy")
