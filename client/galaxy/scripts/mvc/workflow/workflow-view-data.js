import $ from "jquery";

export class DataInputView {
    constructor(options = {}) {
        this.input = options.input;
        this.terminalElement = options.terminalElement;
        const input = options.input;
        const label = input.label || input.name;
        this.$el = $(`<div class="form-row dataRow input-data-row"/>`);
        this.$el.attr("name", this.input.name).html(label);
    }
}

export class DataOutputView {
    constructor(app, options = {}) {
        this.$el = $(`<div class="form-row dataRow"/>`);
        this.output = options.output;
        this.terminalElement = options.terminalElement;
        const output = this.output;
        let label = output.label || output.name;
        const isInput = output.extensions.indexOf("input") >= 0;
        const datatype = output.force_datatype || output.extensions.join(", ");
        if (!isInput) {
            label = `${label} (${datatype})`;
        }
        this.$el.html(label);
    }
}

export class ParameterOutputView {
    constructor(app, options = {}) {
        this.$el = $(`<div class="form-row dataRow"/>`);
        this.output = options.output;
        this.terminalElement = options.terminalElement;
        const output = this.output;
        const label = output.label || output.name;
        this.$el.html(label);
    }
}

export class OutputCalloutView {
    constructor(app, options = {}) {
        this.$el = $("<div/>");
        this.label = options.label;
        this.node = options.node;
        this.output = options.output;
        const node = this.node;
        const outputName = this.output.name;
        this.$el
            .attr("class", `callout-terminal ${outputName}`)
            .append(
                $("<icon />")
                    .addClass("mark-terminal")
                    .click(() => {
                        if (node.isWorkflowOutput(outputName)) {
                            node.removeWorkflowOutput(outputName);
                        } else {
                            node.addWorkflowOutput(outputName);
                        }
                        this.render();
                        app.has_changes = true;
                        app.canvas_manager.draw_overview();
                    })
            )
            .tooltip({
                delay: 500,
                title: "Unchecked output datasets will be hidden.",
            });
        this.render();
    }
    render() {
        if (!this.node.isWorkflowOutput(this.output.name)) {
            this.$el.find("icon").removeClass("mark-terminal-active");
        } else {
            this.$el.find("icon").addClass("mark-terminal-active");
        }
    }
}
