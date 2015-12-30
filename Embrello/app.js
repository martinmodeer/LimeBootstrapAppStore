lbs.apploader.register('Embrello', function () {
    var self = this;

    /*Config (version 2.0)
        This is the setup of your app. Specify which data and resources that should loaded to set the enviroment of your app.
        App specific setup for your app to the config section here, i.e self.config.yourPropertiy:'foo'
        The variabels specified in "config:{}", when you initalize your app are available in in the object "appConfig".
    */
    self.config =  function(appConfig){
            this.boards = appConfig.boards;
            this.dataSources = [];
            this.resources = {
                scripts: ['script/numeraljs/numeral.min.js'], // <= External libs for your apps. Must be a file
                styles: ['app.css'], // <= Load styling for the app.
                libs: ['json2xml.js'] // <= Already included libs, put not loaded per default. Example json2xml.js
            };
    };

    //initialize
    /*Initialize
        Initialize happens after the data and recources are loaded but before the view is rendered.
        Here it is your job to implement the logic of your app, by attaching data and functions to 'viewModel' and then returning it
        The data you requested along with localization are delivered in the variable viewModel.
        You may make any modifications you please to it or replace is with a entirely new one before returning it.
        The returned viewModel will be used to build your app.
        
        Node is a reference to the HTML-node where the app is being initalized form. Frankly we do not know when you'll ever need it,
        but, well, here you have it.
    */
    self.initialize = function (node, viewModel) {

        // Get current LIME Pro client language
        self.lang = lbs.common.executeVba('App_Embrello.getLocale');
        
        // Set up board variable to be filled later if table is activated.
        self.b = {};
        self.b.lanes = ko.observableArray();
        
        // Set event handlers
        var refreshButtons = $('.embrello-refresh');

        refreshButtons.hover(function() {
            $(this).addClass('fa-spin');
        },
        function() {
            $(this).removeClass('fa-spin');
        });

        refreshButtons.click(function() {
            viewModel.board(initBoard());
        });

        initBoard = function() {
            // Clear old board data
            self.b.name = '';
            self.b.lanes([]);

            // Get config for active table
            self.activeTable = lbs.common.executeVba('app_Embrello.getActiveTable');
            var boardConfig = $.grep(self.config.boards, function(obj, i) {
                return obj.table === self.activeTable;
            });
            
            // Check if valid active table
            if (boardConfig.length !== 1) {
                $('.embrello-board').hide();
                $('.embrello-notactivated-container').show();
                return self.b;
            }
            else {
                $('.embrello-notactivated-container').hide();
                $('.embrello-board').show();
            }

            // Get JSON data and fill board variable
            var data = {};

            var boardForVBA = { board: boardConfig[0] };
            var vbaCommand = 'App_Embrello.getBoardXML, ' + json2xml(boardForVBA);
            lbs.loader.loadDataSource(data, { type: 'xml', source: vbaCommand, alias: 'board' }, false);
            
            self.b.name = lbs.common.executeVba('app_Embrello.getActiveBoardName');
            lbs.log.debug(self.b.name);
            self.b.sumLocalFieldName = lbs.common.executeVba('app_Embrello.getSumLocalFieldName,' + boardConfig[0].table + ',' + boardConfig[0].card.sumField);
            self.b.additionalInfoIcon = boardConfig[0].card.additionalInfo.icon;
            
            $.each(data.board.data.Lanes, function(i, laneObj) {
                var cardsArray = ko.observableArray();
                var laneSum = 0;
                // lbs.log.debug(laneObj.name);
                if (laneObj.Cards !== undefined) {
                    if ($.isArray(laneObj.Cards)) {
                        $.each(laneObj.Cards, function(j, cardObj) {
                            cardsArray.push({ title: cardObj.title,
                                    additionalInfo: strMakePretty(cardObj.additionalInfo),
                                    completionRate: cardObj.completionRate,
                                    sumValue: cardObj.sumValue,
                                    sortValue: cardObj.sortValue,
                                    owner: cardObj.owner,
                                    link: cardObj.link
                            });
                            laneSum = laneSum + parseFloat(cardObj.sumValue);
                            // lbs.log.debug(parseFloat(laneSum).toString());
                        });

                        // Sort the cards
                        if (boardConfig[0].card.sorting) {
                            cardsArray.sort(function (left, right) {
                                if (boardConfig[0].card.sorting.descending) {
                                    return left.sortValue === right.sortValue ? 0 : (left.sortValue < right.sortValue ? 1 : -1);
                                }
                                else {
                                    return left.sortValue === right.sortValue ? 0 : (left.sortValue < right.sortValue ? -1 : 1);
                                }
                            });
                        }
                    }
                    else
                    {
                        cardsArray.push({ title: laneObj.Cards.title,
                                additionalInfo: strMakePretty(laneObj.Cards.additionalInfo),
                                completionRate: laneObj.Cards.completionRate,
                                sumValue: laneObj.Cards.sumValue,
                                sortValue: laneObj.Cards.sortValue,
                                owner: laneObj.Cards.owner,
                                link: laneObj.Cards.link
                        });
                        laneSum = parseFloat(laneObj.Cards.sumValue);
                    }
                }
                self.b.lanes.push({ name: laneObj.name,
                        cards: cardsArray,
                        sum: numericStringMakePretty(laneSum.toString())
                });
            });

            // Set dynamic css property to make room for all lanes in width.
            var laneWidth = $('.embrello-lane-container').css('width').replace(/\D+/g, '');     // replace all non-digits with nothing
            $('.embrello-lanes-container').css('width', self.b.lanes().length * laneWidth);
            
            // Set dynamic css property to use the whole body height.
            var bodyHeight = $('body').css('height').replace(/\D+/g, '');     // replace all non-digits with nothing
            $('.embrello-board').css('height', bodyHeight - 20);
            // alert($('body').css('height'));

            return self.b;
        }

        /*  Returns the specified sum as a string either with two decimals or without decimals
            depending on if they are "00" or not. */
        numericStringMakePretty = function(str) {

            // Check if integer or float
            if (parseFloat(str).toFixed(2).toString().substr(-2) === "00") {
                // lbs.log.debug('int');
                return localizeNumber(numeral(str).format('0,0'));
            }
            else {
                // lbs.log.debug('float');
                return localizeNumber(numeral(str).format('0,0.00'));
            }
        }

        /* Makes a string pretty depending on what kind of info it contains. */
        strMakePretty = function(str) {
            if (isNaN(str)) {
                return str;
            }
            else {
                return numericStringMakePretty(str);
                //##TODO: Cover dates here as well (maybe relevant for additionalInfo on helpdesk table). Use moment?
            }
        }

        /*  Returns the string passed as a correctly formatted string according to the environment language.
            Only has support for sv or en-us (default) at the moment. */
        localizeNumber = function(str) {
            if (self.lang === 'sv') {
                return str.replace(',', ' ').replace('.', ',');
            }
            else return str;
        }

        /* Called when clicking a card. */
        viewModel.openLIMERecord = function(link) {
            if (link !== '') {
                window.location.href = link;
            }
        }

        viewModel.board = ko.observable(initBoard());

        return viewModel;
    };
});