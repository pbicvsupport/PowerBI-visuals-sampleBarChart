module powerbi.extensibility.visual {
    // powerbi.visuals
    import ISelectionId = powerbi.visuals.ISelectionId;

    /**
     * Interface for BarCharts viewmodel.
     *
     * @interface
     * @property {BarChartDataPoint[]} dataPoints - Set of data points the visual will render.
     * @property {number} dataMax                 - Maximum data value in the set of data points.
     */
    interface BarChartViewModel {
        dataPoints: BarChartDataPoint[];
        dataMax: number;
        settings: BarChartSettings;
    };

    /**
     * Interface for BarChart data points.
     *
     * @interface
     * @property {number} value             - Data value for point.
     * @property {string} category          - Corresponding category of data value.
     * @property {string} color             - Color corresponding to data point.
     * @property {ISelectionId} selectionId - Id assigned to data point for cross filtering
     *                                        and visual interaction.
     */
    interface BarChartDataPoint {
        value: PrimitiveValue;
        category: string;
        color: string;
        strokeColor: string;
        strokeWidth: number;
        selectionId: ISelectionId;
    };

    /**
     * Interface for BarChart settings.
     *
     * @interface
     * @property {{show:boolean}} enableAxis - Object property that allows axis to be enabled.
     * @property {{generalView.opacity:number}} Bars Opacity - Controls opacity of plotted bars, values range between 10 (almost transparent) to 100 (fully opaque, default)
     * @property {{generalView.showHelpLink:boolean}} Show Help Button - When TRUE, the plot displays a button which launch a link to documentation.
     */
    interface BarChartSettings {
        enableAxis: {
            show: boolean;
            fill: string;
        };

        generalView: {
            opacity: number;
            showHelpLink: boolean;
            helpLinkColor: string;
        };

        averageLine: {
            show: boolean;
            displayName: string;
            fill: string;
            showDataLabel: boolean;
        };
    }

    /**
     * Function that converts queried data into a view model that will be used by the visual.
     *
     * @function
     * @param {VisualUpdateOptions} options - Contains references to the size of the container
     *                                        and the dataView which contains all the data
     *                                        the visual had queried.
     * @param {IVisualHost} host            - Contains references to the host which contains services
     */
    function visualTransform(options: VisualUpdateOptions, host: IVisualHost): BarChartViewModel {
        let dataViews = options.dataViews;
        let defaultSettings: BarChartSettings = {
            enableAxis: {
                show: false,
                fill: "#000000",
            },
            generalView: {
                opacity: 100,
                showHelpLink: false,
                helpLinkColor: "#80B0E0",
            },
            averageLine: {
                show: false,
                displayName: "Average Line",
                fill: "#888888",
                showDataLabel: false
            }
        };
        let viewModel: BarChartViewModel = {
            dataPoints: [],
            dataMax: 0,
            settings: <BarChartSettings>{}
        };

        if (!dataViews
            || !dataViews[0]
            || !dataViews[0].categorical
            || !dataViews[0].categorical.categories
            || !dataViews[0].categorical.categories[0].source
            || !dataViews[0].categorical.values
        ) {
            return viewModel;
        }

        let categorical = dataViews[0].categorical;
        let category = categorical.categories[0];
        let dataValue = categorical.values[0];

        let barChartDataPoints: BarChartDataPoint[] = [];
        let dataMax: number;

        let colorPalette: ISandboxExtendedColorPalette = host.colorPalette;
        let objects = dataViews[0].metadata.objects;

        const strokeColor: string = getColumnStrokeColor(colorPalette);

        let barChartSettings: BarChartSettings = {
            enableAxis: {
                show: getValue<boolean>(objects, 'enableAxis', 'show', defaultSettings.enableAxis.show),
                fill: getAxisTextFillColor(objects, colorPalette, defaultSettings.enableAxis.fill),
            },
            generalView: {
                opacity: getValue<number>(objects, 'generalView', 'opacity', defaultSettings.generalView.opacity),
                showHelpLink: getValue<boolean>(objects, 'generalView', 'showHelpLink', defaultSettings.generalView.showHelpLink),
                helpLinkColor: strokeColor,
            },
            averageLine: {
                show: getValue<boolean>(objects, 'averageLine', 'show', defaultSettings.averageLine.show),
                displayName: getValue<string>(objects, 'averageLine', 'displayName', defaultSettings.averageLine.displayName),
                fill: getValue<string>(objects, 'averageLine', 'fill', defaultSettings.averageLine.fill),
                showDataLabel: getValue<boolean>(objects, 'averageLine', 'showDataLabel', defaultSettings.averageLine.showDataLabel),
            },
        };

        const strokeWidth: number = getColumnStrokeWidth(colorPalette.isHighContrast);

        for (let i = 0, len = Math.max(category.values.length, dataValue.values.length); i < len; i++) {
            const color: string = getColumnColorByIndex(category, i, colorPalette);

            const selectionId: ISelectionId = host.createSelectionIdBuilder()
                .withCategory(category, i)
                .createSelectionId();

            barChartDataPoints.push({
                color,
                strokeColor,
                strokeWidth,
                selectionId,
                value: dataValue.values[i],
                category: `${category.values[i]}`,
            });
        }

        dataMax = <number>dataValue.maxLocal;

        return {
            dataPoints: barChartDataPoints,
            dataMax: dataMax,
            settings: barChartSettings,
        };
    }

    function getColumnColorByIndex(
        category: DataViewCategoryColumn,
        index: number,
        colorPalette: ISandboxExtendedColorPalette,
    ): string {
        if (colorPalette.isHighContrast) {
            return colorPalette.background.value;
        }

        const defaultColor: Fill = {
            solid: {
                color: colorPalette.getColor(`${category.values[index]}`).value,
            }
        };

        return getCategoricalObjectValue<Fill>(
            category,
            index,
            'colorSelector',
            'fill',
            defaultColor
        ).solid.color;
    }

    function getColumnStrokeColor(colorPalette: ISandboxExtendedColorPalette): string {
        return colorPalette.isHighContrast
            ? colorPalette.foreground.value
            : null;
    }

    function getColumnStrokeWidth(isHighContrast: boolean): number {
        return isHighContrast
            ? 2
            : 0;
    }

    function getAxisTextFillColor(
        objects: DataViewObjects,
        colorPalette: ISandboxExtendedColorPalette,
        defaultColor: string
    ): string {
        if (colorPalette.isHighContrast) {
            return colorPalette.foreground.value;
        }

        return getValue<Fill>(
            objects,
            "enableAxis",
            "fill",
            {
                solid: {
                    color: defaultColor,
                }
            },
        ).solid.color;
    }

    export class BarChart implements IVisual {
        private svg: d3.Selection<SVGElement>;
        private host: IVisualHost;
        private selectionManager: ISelectionManager;
        private barContainer: d3.Selection<SVGElement>;
        private xAxis: d3.Selection<SVGElement>;
        private barDataPoints: BarChartDataPoint[];
        private barChartSettings: BarChartSettings;
        private tooltipServiceWrapper: ITooltipServiceWrapper;
        private locale: string;
        private helpLinkElement: d3.Selection<any>;
        private element: HTMLElement;
        private isLandingPageOn: boolean;
        private LandingPageRemoved: boolean;
        private LandingPage: d3.Selection<any>;
        private averageLine: d3.Selection<SVGElement>;

        private barSelection: d3.selection.Update<BarChartDataPoint>;

        static Config = {
            xScalePadding: 0.1,
            solidOpacity: 1,
            transparentOpacity: 0.4,
            margins: {
                top: 0,
                right: 0,
                bottom: 25,
                left: 30,
            },
            xAxisFontMultiplier: 0.04,
        };

        /**
         * Creates instance of BarChart. This method is only called once.
         *
         * @constructor
         * @param {VisualConstructorOptions} options - Contains references to the element that will
         *                                             contain the visual and a reference to the host
         *                                             which contains services.
         */
        constructor(options: VisualConstructorOptions) {
            this.host = options.host;
            this.element = options.element;
            this.selectionManager = options.host.createSelectionManager();

            this.selectionManager.registerOnSelectCallback(() => {
                this.syncSelectionState(this.barSelection, this.selectionManager.getSelectionIds() as ISelectionId[]);
            });

            this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService, options.element);

            this.svg = d3.select(options.element)
                .append('svg')
                .classed('barChart', true);

            this.locale = options.host.locale;

            this.barContainer = this.svg
                .append('g')
                .classed('barContainer', true);

            this.xAxis = this.svg
                .append('g')
                .classed('xAxis', true);

            this.initAverageLine();

            const helpLinkElement: Element = this.createHelpLinkElement();
            options.element.appendChild(helpLinkElement);

            this.helpLinkElement = d3.select(helpLinkElement);
        }

        /**
         * Updates the state of the visual. Every sequential databinding and resize will call update.
         *
         * @function
         * @param {VisualUpdateOptions} options - Contains references to the size of the container
         *                                        and the dataView which contains all the data
         *                                        the visual had queried.
         */
        public update(options: VisualUpdateOptions) {
            let viewModel: BarChartViewModel = visualTransform(options, this.host);
            let settings = this.barChartSettings = viewModel.settings;
            this.barDataPoints = viewModel.dataPoints;

            // Turn on landing page in capabilities and remove comment to turn on landing page!
            // this.HandleLandingPage(options);

            let width = options.viewport.width;
            let height = options.viewport.height;

            this.svg.attr({
                width: width,
                height: height
            });

            if (settings.enableAxis.show) {
                let margins = BarChart.Config.margins;
                height -= margins.bottom;
            }

            this.helpLinkElement
                .classed("hidden", !settings.generalView.showHelpLink)
                .style({
                    "border-color": settings.generalView.helpLinkColor,
                    "color": settings.generalView.helpLinkColor,
                });

            this.xAxis.style({
                "font-size": d3.min([height, width]) * BarChart.Config.xAxisFontMultiplier,
                "fill": settings.enableAxis.fill,
            });

            let yScale = d3.scale.linear()
                .domain([0, viewModel.dataMax])
                .range([height, 0]);

            let xScale = d3.scale.ordinal()
                .domain(viewModel.dataPoints.map(d => d.category))
                .rangeRoundBands([0, width], BarChart.Config.xScalePadding, 0.2);

            let xAxis = d3.svg.axis()
                .scale(xScale)
                .orient('bottom');

            this.xAxis.attr('transform', 'translate(0, ' + height + ')')
                .call(xAxis);

            this.handleAverageLineUpdate(height, width, yScale);

            this.barSelection = this.barContainer
                .selectAll('.bar')
                .data(this.barDataPoints);

            this.barSelection
                .enter()
                .append('rect')
                .classed('bar', true);

            const opacity: number = viewModel.settings.generalView.opacity / 100;

            this.barSelection
                .attr({
                    width: xScale.rangeBand(),
                    height: d => height - yScale(<number>d.value),
                    y: d => yScale(<number>d.value),
                    x: d => xScale(d.category),
                })
                .style({
                    'fill-opacity': opacity,
                    'stroke-opacity': opacity,
                    fill: (dataPoint: BarChartDataPoint) => dataPoint.color,
                    stroke: (dataPoint: BarChartDataPoint) => dataPoint.strokeColor,
                    "stroke-width": (dataPoint: BarChartDataPoint) => `${dataPoint.strokeWidth}px`,
                });

            this.tooltipServiceWrapper.addTooltip(this.barContainer.selectAll('.bar'),
                (tooltipEvent: TooltipEventArgs<BarChartDataPoint>) => this.getTooltipData(tooltipEvent.data),
                (tooltipEvent: TooltipEventArgs<BarChartDataPoint>) => tooltipEvent.data.selectionId
            );

            this.syncSelectionState(
                this.barSelection,
                this.selectionManager.getSelectionIds() as ISelectionId[]
            );

            this.barSelection.on('click', (d) => {
                // Allow selection only if the visual is rendered in a view that supports interactivity (e.g. Report)
                if (this.host.allowInteractions) {
                    const isCtrlPressed: boolean = (d3.event as MouseEvent).ctrlKey;

                    this.selectionManager
                        .select(d.selectionId, isCtrlPressed)
                        .then((ids: ISelectionId[]) => {
                            this.syncSelectionState(this.barSelection, ids);
                        });

                    (<Event>d3.event).stopPropagation();
                }
            });

            this.barSelection
                .exit()
                .remove();

            // Clear selection when clicking outside a bar
            this.svg.on('click', (d) => {
                if (this.host.allowInteractions) {
                    this.selectionManager
                        .clear()
                        .then(() => {
                            this.syncSelectionState(this.barSelection, []);
                        });
                }
            });
            // handle context menu
            this.svg.on('contextmenu', () => {
                const mouseEvent: MouseEvent = d3.event as MouseEvent;
                const eventTarget: EventTarget = mouseEvent.target;
                let dataPoint = d3.select(eventTarget).datum();
                this.selectionManager.showContextMenu(dataPoint ? dataPoint.selectionId : {}, {
                    x: mouseEvent.clientX,
                    y: mouseEvent.clientY
                });
                mouseEvent.preventDefault();
            });
        }

        private syncSelectionState(
            selection: d3.Selection<BarChartDataPoint>,
            selectionIds: ISelectionId[]
        ): void {
            if (!selection || !selectionIds) {
                return;
            }

            if (!selectionIds.length) {
                selection.style({
                    "fill-opacity": null,
                    "stroke-opacity": null,
                });

                return;
            }

            const self: this = this;

            selection.each(function (barDataPoint: BarChartDataPoint) {
                const isSelected: boolean = self.isSelectionIdInArray(selectionIds, barDataPoint.selectionId);

                const opacity: number = isSelected
                    ? BarChart.Config.solidOpacity
                    : BarChart.Config.transparentOpacity;

                d3.select(this).style({
                    "fill-opacity": opacity,
                    "stroke-opacity": opacity,
                });
            });
        }

        private isSelectionIdInArray(selectionIds: ISelectionId[], selectionId: ISelectionId): boolean {
            if (!selectionIds || !selectionId) {
                return false;
            }

            return selectionIds.some((currentSelectionId: ISelectionId) => {
                return currentSelectionId.includes(selectionId);
            });
        }

        /**
         * Enumerates through the objects defined in the capabilities and adds the properties to the format pane
         *
         * @function
         * @param {EnumerateVisualObjectInstancesOptions} options - Map of defined objects
         */
        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
            let objectName = options.objectName;
            let objectEnumeration: VisualObjectInstance[] = [];

            if (!this.barChartSettings ||
                !this.barChartSettings.enableAxis ||
                !this.barDataPoints) {
                return objectEnumeration;
            }

            switch (objectName) {
                case 'enableAxis':
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            show: this.barChartSettings.enableAxis.show,
                            fill: this.barChartSettings.enableAxis.fill,
                        },
                        selector: null
                    });
                    break;
                case 'colorSelector':
                    for (let barDataPoint of this.barDataPoints) {
                        objectEnumeration.push({
                            objectName: objectName,
                            displayName: barDataPoint.category,
                            properties: {
                                fill: {
                                    solid: {
                                        color: barDataPoint.color
                                    }
                                }
                            },
                            selector: barDataPoint.selectionId.getSelector()
                        });
                    }
                    break;
                case 'generalView':
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            opacity: this.barChartSettings.generalView.opacity,
                            showHelpLink: this.barChartSettings.generalView.showHelpLink
                        },
                        validValues: {
                            opacity: {
                                numberRange: {
                                    min: 10,
                                    max: 100
                                }
                            }
                        },
                        selector: null
                    });
                    break;
                case 'averageLine':
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            show: this.barChartSettings.averageLine.show,
                            displayName: this.barChartSettings.averageLine.displayName,
                            fill: this.barChartSettings.averageLine.fill,
                            showDataLabel: this.barChartSettings.averageLine.showDataLabel
                        },
                        selector: null
                    });
                    break;
            };

            return objectEnumeration;
        }

        /**
         * Destroy runs when the visual is removed. Any cleanup that the visual needs to
         * do should be done here.
         *
         * @function
         */
        public destroy(): void {
            // Perform any cleanup tasks here
        }

        private getTooltipData(value: any): VisualTooltipDataItem[] {
            let language = getLocalizedString(this.locale, "LanguageKey");
            return [{
                displayName: value.category,
                value: value.value.toString(),
                color: value.color,
                header: language && "displayed language " + language
            }];
        }

        private createHelpLinkElement(): Element {
            let linkElement = document.createElement("a");
            linkElement.textContent = "?";
            linkElement.setAttribute("title", "Open documentation");
            linkElement.setAttribute("class", "helpLink");
            linkElement.addEventListener("click", () => {
                this.host.launchUrl("https://microsoft.github.io/PowerBI-visuals/tutorials/building-bar-chart/adding-url-launcher-element-to-the-bar-chart/");
            });
            return linkElement;
        };

        private HandleLandingPage(options: VisualUpdateOptions) {
            if (!options.dataViews || !options.dataViews.length) {
                if (!this.isLandingPageOn) {
                    this.isLandingPageOn = true;
                    const SampleLandingPage: Element = this.createSampleLandingPage();
                    this.element.appendChild(SampleLandingPage);

                    this.LandingPage = d3.select(SampleLandingPage);
                }

            } else {
                    if (this.isLandingPageOn && !this.LandingPageRemoved) {
                        this.LandingPageRemoved = true;
                        this.LandingPage.remove();
                }
            }
        }

        private createSampleLandingPage(): Element {
            let div = document.createElement("div");

            let header = document.createElement("h1");
            header.textContent = "Sample Bar Chart Landing Page";
            header.setAttribute("class", "LandingPage");
            let p1 = document.createElement("a");
            p1.setAttribute("class", "LandingPageHelpLink");
            p1.textContent = "Learn more about Landing page";

            p1.addEventListener("click", () => {
                this.host.launchUrl("https://microsoft.github.io/PowerBI-visuals/docs/overview/");
            });

            div.appendChild(header);
            div.appendChild(p1);

            return div;
        }

        private getColorValue(color: Fill|string): string {
            // Override color settings if in high contrast mode
            if (this.host.colorPalette.isHighContrast) {
                return this.host.colorPalette.foreground.value;
            }

            // If plain string, just return it
            if (typeof(color) === 'string') {
                return color;
            }
            // Otherwise, extract string representation from Fill type object
            return color.solid.color;
        }

        private initAverageLine() {
            this.averageLine = this.svg
                .append('g')
                .classed('averageLine', true);

            this.averageLine.append('line')
                .attr('id', 'averageLine');

            this.averageLine.append('text')
                .attr('id', 'averageLineLabel');
        }

        private handleAverageLineUpdate(height: number, width: number, yScale: d3.scale.Linear<number, number>) {
            let average = this.calculateAverage();
            let fontSize = d3.min([height, width]) * BarChart.Config.xAxisFontMultiplier;
            let chosenColor = this.getColorValue(this.barChartSettings.averageLine.fill);
            // If there's no room to place lable above line, place it below
            let labelYOffset = fontSize * ((yScale(average) > fontSize * 1.5) ? -0.5 : 1.5);

            this.averageLine
                .style({
                    "font-size": fontSize,
                    "display": (this.barChartSettings.averageLine.show) ? "initial" : "none",
                })
                .attr("transform", "translate(0, " + Math.round(yScale(average)) + ")");
            this.averageLine.select("#averageLine")
                .style({
                    "stroke": chosenColor,
                    "stroke-width": "3px",
                    "stroke-dasharray": "6,6",
                })
                .attr({
                    'x1': "0",
                    'x2': "" + width
                });
            this.averageLine.select("#averageLineLabel")
                .text("Average: " + average.toFixed(2))
                .attr("transform", "translate(0, " + labelYOffset + ")")
                .style("fill", this.barChartSettings.averageLine.showDataLabel ? chosenColor : "none");
        }

        private calculateAverage(): number {
            if (this.barDataPoints.length === 0) {
                return 0;
            }

            let total = 0;

            this.barDataPoints.forEach((value: BarChartDataPoint) => {
                total += <number>value.value;
            });

            return total / this.barDataPoints.length;
        }
    }
}
