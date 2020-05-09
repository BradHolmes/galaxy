/* global QUnit */
import $ from "jquery";
import DatatypesMapping from "qunit/test-data/json/datatypes.mapping.json";
import sinon from "sinon";
import Manager from "components/Workflow/Editor/modules/manager";
import Terminals from "components/Workflow/Editor/modules/terminals";
import { InputDragging, OutputDragging } from "components/Workflow/Editor/modules/dragging";
import Connector from "components/Workflow/Editor/modules/connector";
import Vue from "vue";

// create body and app
var create_app = function () {
    // build body
    $("body").append(
        '<div id="canvas-viewport">' +
            '<div id="canvas-container"/>' +
            "</div>" +
            '<div id="overview">' +
            '<canvas id="overview-canvas"/>' +
            '<div id="overview-viewport"/>' +
            "</div>"
    );

    // build app
    return new Manager(
        {
            datatypes: [],
            datatypes_mapping: DatatypesMapping,
        },
        $("#canvas-container")
    );
};

class Node {
    constructor(app, attr = {}) {
        this.app = app;
        this.element = attr.element;
        this.inputTerminals = {};
        this.outputTerminals = {};
        this.errors = null;
    }
    markChanged() {}
}

QUnit.module("Input terminal model test", {
    beforeEach: function () {
        this.app = create_app();
        this.node = new Node(this.app, {});
        this.input = { extensions: ["txt"], multiple: false, optional: false };
        this.input_terminal = new Terminals.InputTerminal({ app: this.app, input: this.input });
        this.input_terminal.node = this.node;
    },
    afterEach: function () {
        delete this.node;
    },
    multiple: function () {
        this.input.multiple = true;
        this.input_terminal.update(this.input);
    },
    test_connector: function () {
        var outputTerminal = new Terminals.OutputTerminal({ datatypes: ["input"] });
        var inputTerminal = this.input_terminal;
        return new Connector({}, outputTerminal, inputTerminal);
    },
    with_test_connector: function (f) {
        this.test_connector();
        f();
        this.reset_connectors();
    },
    reset_connectors: function () {
        this.input_terminal.connectors = [];
    },
    test_accept: function (other) {
        other = other || { node: {}, datatypes: ["txt"], optional: false };
        if (!other.mapOver) {
            other.mapOver = function () {
                return Terminals.NULL_COLLECTION_TYPE_DESCRIPTION;
            };
        }
        return this.input_terminal.canAccept(other).canAccept;
    },
});

QUnit.test("test update", function (assert) {
    assert.deepEqual(this.input_terminal.datatypes, ["txt"]);
    assert.equal(this.input_terminal.multiple, false);
    this.input_terminal.update({ extensions: ["bam"], multiple: true });
    assert.deepEqual(this.input_terminal.datatypes, ["bam"]);
    assert.equal(this.input_terminal.multiple, true);
});

QUnit.test("test connect", function (assert) {
    this.node.markChanged = sinon.spy();
    var connector = {};
    this.input_terminal.connect(connector);
    // Assert node markChanged called
    assert.ok(this.node.markChanged.called);
    // Assert connectors updated
    assert.ok(this.input_terminal.connectors[0] === connector);
});

QUnit.test("test disconnect", function (assert) {
    this.node.markChanged = sinon.spy();
    var connector = this.test_connector();
    this.input_terminal.disconnect(connector);
    // Assert node markChanged called
    assert.ok(this.node.markChanged.called);
    // Assert connectors updated
    assert.equal(this.input_terminal.connectors.length, 0);
});

QUnit.test("test redraw", function (assert) {
    var connector = this.test_connector();
    connector.redraw = sinon.spy();
    this.input_terminal.redraw();
    // Assert connectors were redrawn
    assert.ok(connector.redraw.called);
});

QUnit.test("test destroy", function (assert) {
    var connector = this.test_connector();
    connector.destroy = sinon.spy();
    this.input_terminal.destroy();
    // Assert connectors were destroyed
    assert.ok(connector.destroy.called);
});

QUnit.test("can accept exact datatype", function (assert) {
    var other = { node: {}, datatypes: ["txt"], force_datatype: null }; // input also txt
    assert.ok(this.test_accept(other));
});

QUnit.test("can accept subclass datatype", function (assert) {
    var other = { node: {}, datatypes: ["tabular"] }; // tabular subclass of input txt
    assert.ok(this.test_accept(other));
});

QUnit.test("cannot accept incorrect datatype", function (assert) {
    var other = { node: {}, datatypes: ["binary"] }; // binary is not txt
    assert.ok(!this.test_accept(other));
});

QUnit.test("can accept incorrect datatype if converted with PJA", function (assert) {
    var other = { node: {}, datatypes: ["binary"], force_datatype: "txt", name: "out1" }; // Was binary but converted to txt
    assert.ok(this.test_accept(other));
});

QUnit.test("cannot accept incorrect datatype if converted with PJA to incompatible type", function (assert) {
    var other = { node: {}, datatypes: ["binary"], force_datatype: "bam", name: "out1" };
    assert.ok(!this.test_accept(other));
});

QUnit.test("can accept inputs", function (assert) {
    // Other is data input module - always accept (currently - could be
    // more intelligent by looking at what else input is connected to.
    var other = { node: {}, datatypes: ["input"] };
    assert.ok(this.test_accept(other));
});

QUnit.test("can't connect non-optional", function (assert) {
    var other = { node: {}, datatypes: ["input"], optional: true };
    assert.ok(!this.test_accept(other));
});

QUnit.test("multiple inputs can accept optional outputs regardless", function (assert) {
    // Galaxy multiple inputs have an optional field but it is hard to resolve that
    // completely until runtime.
    var other = { node: {}, datatypes: ["input"], optional: true };
    this.multiple();
    assert.ok(this.test_accept(other));
});

QUnit.test("input type can accept any datatype", function (assert) {
    this.input.extensions = ["input"];
    this.input_terminal.update(this.input);
    var other = { node: {}, datatypes: ["binary"] };
    assert.ok(this.test_accept(other));
});

QUnit.test("cannot accept when already connected", function (assert) {
    // If other is subtype but already connected, cannot accept
    this.with_test_connector(() => {
        assert.ok(!this.test_accept());
    });
});

QUnit.test("can accept already connected inputs if input is multiple", function (assert) {
    this.multiple();
    this.with_test_connector(() => {
        assert.ok(this.test_accept());
    });
});

QUnit.test("cannot accept already connected inputs if input is multiple but datatypes don't match", function (assert) {
    var other = { node: {}, datatypes: ["binary"] }; // binary is not txt
    this.multiple();
    this.with_test_connector(() => {
        assert.ok(!this.test_accept(other));
    });
});

QUnit.test("can accept list collection for multiple input parameters if datatypes match", function (assert) {
    this.multiple();
    assert.ok(this.test_accept());
});

QUnit.test("can accept list collection for empty multiple inputs", function (assert) {
    var other = {
        node: {},
        datatypes: ["tabular"],
        mapOver: new Terminals.CollectionTypeDescription("list"),
    };
    this.multiple();
    assert.ok(this.test_accept(other));
});

QUnit.test("cannot accept list collection for multiple input if collection already connected", function (assert) {
    var other = {
        node: {},
        datatypes: ["tabular"],
        mapOver: new Terminals.CollectionTypeDescription("list"),
    };
    this.multiple();
    this.with_test_connector(() => {
        assert.ok(!this.test_accept(other));
    });
});

QUnit.module("Connector test", {});

QUnit.test("connects only if both valid handles", function (assert) {
    const input = { connect: sinon.spy() };
    const output = { connect: sinon.spy() };
    new Connector({}, input, null);
    new Connector({}, null, output);
    // Not attempts to connect...
    assert.ok(!input.connect.called);
    assert.ok(!output.connect.called);
    new Connector({}, input, output);
    assert.ok(input.connect.called);
    assert.ok(output.connect.called);
});

QUnit.test("default attributes", function (assert) {
    const input = { connect: sinon.spy() };
    const output = { connect: sinon.spy() };
    const connector = new Connector({}, input, output);
    assert.equal(connector.dragging, false);
    assert.equal(connector.svg.attr("class"), "ribbon");
});

QUnit.test("destroy", function (assert) {
    const input = { connect: sinon.spy(), disconnect: sinon.spy() };
    const output = { connect: sinon.spy(), disconnect: sinon.spy() };
    const connector = new Connector({}, input, output);
    connector.destroy();
    assert.ok(input.disconnect.called);
    assert.ok(output.disconnect.called);
});

QUnit.test("initial redraw", function (assert) {
    const input = {
        connect: sinon.spy(),
        element: $("<div>"),
        isMappedOver: function () {
            return false;
        },
    };
    const output = {
        connect: sinon.spy(),
        element: $("<div>"),
        isMappedOver: function () {
            return false;
        },
    };
    const n = $("#canvas-container").find("svg").length;
    const connector = new Connector({}, input, output);
    // Ensure canvas gets set
    assert.ok(connector.canvas);
    // Ensure it got added to canvas container
    assert.equal(n + 1, $("#canvas-container").find("svg").length);
});

QUnit.module("Input collection terminal model test", {
    beforeEach: function () {
        this.app = create_app();
        this.node = new Node(this.app, {});
        this.input = { extensions: ["txt"], collection_types: ["list"] };
        this.input_terminal = new Terminals.InputCollectionTerminal({ app: this.app, input: this.input });
        this.input_terminal.node = this.node;
    },
    afterEach: function () {
        delete this.node;
    },
});

QUnit.test("Collection output can connect to same collection input type", function (assert) {
    const inputTerminal = this.input_terminal;
    const outputTerminal = new Terminals.OutputCollectionTerminal({
        datatypes: "txt",
        collection_type: "list",
    });
    outputTerminal.node = {};
    assert.ok(
        inputTerminal.canAccept(outputTerminal).canAccept,
        "Input terminal " + inputTerminal + " can not accept " + outputTerminal
    );
});

QUnit.test("Optional collection output can not connect to required collection input", function (assert) {
    const inputTerminal = this.input_terminal;
    const outputTerminal = new Terminals.OutputCollectionTerminal({
        datatypes: "txt",
        collection_type: "list",
        optional: true,
    });
    outputTerminal.node = {};
    assert.ok(!inputTerminal.canAccept(outputTerminal).canAccept);
});

QUnit.test("Collection output cannot connect to different collection input type", function (assert) {
    var inputTerminal = this.input_terminal;
    var outputTerminal = new Terminals.OutputCollectionTerminal({
        datatypes: "txt",
        collection_type: "paired",
    });
    outputTerminal.node = {};
    assert.ok(!inputTerminal.canAccept(outputTerminal).canAccept);
});

QUnit.module("Node unit test", {
    beforeEach: function () {
        this.input_terminal = { destroy: sinon.spy(), redraw: sinon.spy() };
        this.output_terminal = { destroy: sinon.spy(), redraw: sinon.spy() };
        this.app = create_app();
        this.node = this.app.build_node("tool", "newnode");
        this.element = this.node.element;
        this.node.inputTerminals.i1 = this.input_terminal;
        this.node.outputTerminals.o1 = this.output_terminal;
    },
    $: function (selector) {
        return $(this.node.element).find(selector);
    },
    expect_workflow_node_changed: function (assert, f) {
        const node = this.node;
        const node_changed_spy = sinon.spy(this.app, "node_changed");
        f();
        assert.ok(node_changed_spy.calledWith(node));
    },
    init_field_data_simple: function () {
        const data = {
            inputs: [{ name: "input1", extensions: ["data"] }],
            outputs: [{ name: "output1", extensions: ["data"] }],
            name: "newnode",
            label: null,
        };
        this.node.initFieldData(data);
    },
    update_field_data_with_new_input: function () {
        const data = {
            inputs: [
                { name: "input1", extensions: ["data"] },
                { name: "extra_0|input1", extensions: ["data"] },
            ],
            outputs: [{ name: "output1", extensions: ["data"] }],
            postJobActions: {},
            label: "New Label",
        };
        this.node.updateFieldData(data);
    },
});

QUnit.test("make active", function (assert) {
    assert.ok(this.element.className.indexOf("node-active") == -1);
    this.node.makeActive();
    assert.ok(this.element.className.indexOf("node-active") != -1);
});

QUnit.test("destroy", function (assert) {
    var remove_node_spy = sinon.spy(this.app, "remove_node");
    this.node.onDestroy();
    assert.ok(this.input_terminal.destroy.called);
    assert.ok(this.output_terminal.destroy.called);
    assert.ok(remove_node_spy.calledWith(this.node));
});

QUnit.test("error", function (assert) {
    // Test body of div updated and workflow notified of change.
    const node_changed_spy = sinon.spy(this.app, "node_changed");
    this.node.initFieldData({ errors: "NODE ERROR", inputs: [], outputs: [] });
    Vue.nextTick(() => {
        const errorText = $(this.node.element).find(".node-error").text().trim();
        assert.equal(errorText, "NODE ERROR");
        assert.ok(node_changed_spy.calledWith(this.node));
    });
});

QUnit.test("init_field_data properties", function (assert) {
    const data = {
        inputs: [],
        outputs: [],
        type: "tool",
        name: "cat1",
        config_form: "{}",
        tool_state: "ok",
        tool_errors: false,
        tooltip: "tool tooltip",
        annotation: "tool annotation",
        workflow_outputs: [{ output_name: "out1" }],
        label: "Cat that data.",
    };
    const node = this.node;
    const node_changed_spy = sinon.spy(this.app, "node_changed");
    this.node.initFieldData(data);
    Vue.nextTick(() => {
        assert.equal(node.type, "tool");
        assert.equal(node.name, "cat1");
        assert.equal(node.config_form, "{}");
        assert.equal(node.tool_state, "ok");
        assert.equal(node.tooltip, "tool tooltip");
        assert.equal(node.annotation, "tool annotation");
        assert.equal(node.label, "Cat that data.");
        assert.deepEqual(node.postJobActions, {});
        assert.ok(node.activeOutputs.get("out1"));
        assert.ok(node_changed_spy.calledWith(node));
    });
});

QUnit.test("init_field_data data", function (assert) {
    // pre-init not tool form body...
    assert.equal(this.$(".output-terminal").length, 0);
    assert.equal(this.$(".input-terminal").length, 0);
    assert.equal(this.$(".rule").length, 0);
    const node_changed_spy = sinon.spy(this.app, "node_changed");
    this.init_field_data_simple();
    Vue.nextTick(() => {
        assert.ok(node_changed_spy.calledWith(this.node));
        assert.equal(this.$(".output-terminal").length, 1);
        assert.equal(this.$(".input-terminal").length, 1);
        assert.equal(this.$(".rule").length, 1);
        assert.equal(this.$(".node-body").children().length, 3);
        assert.equal(this.$(".node-title").text(), "newnode");
        assert.ok(this.$(".node-header").find("i").hasClass("fa-wrench"));
    });
});

QUnit.test("node title behavior", function (assert) {
    assert.equal(this.$(".node-title").text(), "newnode");
    const node_changed_spy = sinon.spy(this.app, "node_changed");
    this.init_field_data_simple();
    this.update_field_data_with_new_input();
    Vue.nextTick(() => {
        assert.equal(this.$(".node-title").text(), "New Label");
        assert.ok(node_changed_spy.calledWith(this.node));
    });
});

QUnit.test("update_field_data updated data inputs and outputs", function (assert) {
    const node_changed_spy = sinon.spy(this.app, "node_changed");
    // Call init with one input and output.
    this.init_field_data_simple();
    this.update_field_data_with_new_input();
    Vue.nextTick(() => {
        // Now there are 2 inputs...
        assert.equal(this.$(".input-terminal").length, 2);
        assert.equal(this.$(".output-terminal").length, 1);
        assert.equal(this.$(".rule").length, 1);
        assert.ok(node_changed_spy.calledWith(this.node));
    });
});

QUnit.test("update_field_data preserves connectors", function (assert) {
    const node_changed_spy = sinon.spy(this.app, "node_changed");
    // Call init with one input and output.
    this.init_field_data_simple();

    Vue.nextTick(() => {
        const node = this.node;
        const connector = new Connector({});
        const old_input_terminal = node.inputTerminals.input1;
        old_input_terminal.connectors.push(connector);

        // Update node, make sure connector still the same...
        this.update_field_data_with_new_input();
        Vue.nextTick(() => {
            assert.ok(node_changed_spy.calledWith(this.node));

            var new_input_terminal = node.inputTerminals.input1;
            assert.equal(connector, new_input_terminal.connectors[0]);

            // Update a second time, make sure connector still the same...
            this.update_field_data_with_new_input();
            Vue.nextTick(() => {
                new_input_terminal = node.inputTerminals.input1;
                assert.equal(connector, new_input_terminal.connectors[0]);
            });
        });
    });
});

QUnit.test("update_field_data destroys old terminals", function (assert) {
    const node = this.node;
    const node_changed_spy = sinon.spy(this.app, "node_changed");
    var data = {
        inputs: [
            { name: "input1", extensions: ["data"] },
            { name: "willDisappear", extensions: ["data"] },
        ],
        outputs: [{ name: "output1", extensions: ["data"] }],
    };
    node.initFieldData(data);
    Vue.nextTick(() => {
        const old_input_terminal = node.inputTerminals.willDisappear;
        const destroy_spy = sinon.spy(old_input_terminal, "destroy");
        this.update_field_data_with_new_input();
        assert.ok(destroy_spy.called);
        assert.ok(node_changed_spy.called);
    });
});

QUnit.module("create_node", {
    beforeEach: function () {
        this.app = create_app();
    },
});

QUnit.test("node added to workflow", function (assert) {
    const activate_node_spy = sinon.spy(this.app, "activate_node");
    const node = this.app.create_node("tool", "Cat Files", "cat1");
    assert.ok(activate_node_spy.calledWith(node));
});

QUnit.module("Node view", {
    beforeEach: function () {
        this.app = create_app();
        this.node = this.app.build_node("tool", "newnode");
    },
    afterEach: function () {
        delete this.node;
    },
    connectAttachedTerminal: function (inputType, outputType, callback) {
        const data = {
            inputs: [{ name: "TestName", extensions: [inputType] }],
            outputs: [],
        };
        this.node.updateFieldData(data);
        Vue.nextTick(() => {
            var terminal = this.node.inputTerminals["TestName"];
            var outputTerminal = new Terminals.OutputTerminal({
                name: "TestOutput",
                datatypes: [outputType],
                mapOver: Terminals.NULL_COLLECTION_TYPE_DESCRIPTION,
            });
            outputTerminal.node = {
                markChanged: function () {},
                postJobActions: [],
                inputTerminals: {},
                outputTerminals: {},
                hasMappedOverInputTerminals: function () {
                    return false;
                },
                hasConnectedOutputTerminals: function () {
                    return true;
                },
            };
            callback(new Connector({}, outputTerminal, terminal));
        });
    },
    connectAttachedMultiInputTerminal: function (inputType, outputType, callback) {
        const data = {
            inputs: [{ name: "TestName", extensions: [inputType], multiple: true }],
            outputs: [],
        };
        this.node.updateFieldData(data);
        Vue.nextTick(() => {
            var terminal = this.node.inputTerminals["TestName"];
            var outputTerminal = new Terminals.OutputTerminal({
                name: "TestOutput",
                datatypes: ["txt"],
                mapOver: new Terminals.CollectionTypeDescription("list"),
            });
            outputTerminal.node = {
                markChanged: function () {},
                postJobActions: [],
                inputTerminals: {},
                outputTerminals: {},
                hasMappedOverInputTerminals: function () {
                    return false;
                },
                hasConnectedOutputTerminals: function () {
                    return true;
                },
            };
            callback(new Connector({}, outputTerminal, terminal));
        });
    },
    connectAttachedMappedOutput: function (callback) {
        Vue.nextTick(() => {
            var terminal = this.node.inputTerminals["TestName"];
            var outputTerminal = new Terminals.OutputTerminal({
                name: "TestOutput",
                datatypes: ["txt"],
                mapOver: new Terminals.CollectionTypeDescription("list"),
            });
            outputTerminal.node = {
                markChanged: function () {},
                postJobActions: [],
                inputTerminals: {},
                outputTerminals: {},
                hasMappedOverInputTerminals: function () {
                    return false;
                },
                hasConnectedOutputTerminals: function () {
                    return true;
                },
            };
            const connector = new Connector({}, outputTerminal, terminal);
            callback(connector);
        });
    },
});

QUnit.test("replacing terminal on data input update preserves connections", function (assert) {
    this.node.inputs.push({ name: "TestName", extensions: ["txt"] });
    this.connectAttachedTerminal("txt", "txt", (connector) => {
        var terminal = $(this.node.element).find(".input-terminal")[0].terminal;
        assert.ok(connector.inputHandle === terminal);
    });
});

QUnit.test("replacing terminal on data multiple input update preserves collection connections", function (assert) {
    this.node.inputs.push({ name: "TestName", extensions: ["txt"] });
    this.connectAttachedMultiInputTerminal("txt", "txt", (connector) => {
        var connector_destroy_spy = sinon.spy(connector, "destroy");
        const data = {
            inputs: [{ name: "TestName", extensions: ["txt"], multiple: true }],
            outputs: [],
        };
        this.node.updateFieldData(data);
        Vue.nextTick(() => {
            assert.ok(!connector_destroy_spy.called);
        });
    });
});

QUnit.test("replacing mapped terminal on data collection input update preserves connections", function (assert) {
    this.node.inputs.push({ name: "TestName", extensions: ["txt"], input_type: "dataset_collection" });
    this.connectAttachedMappedOutput((connector) => {
        const terminal = $(this.node.element).find(".input-terminal")[0].terminal;
        const data = {
            inputs: [{ name: "TestName", extensions: ["txt"], input_type: "dataset_collection" }],
            outputs: [],
        };
        this.node.updateFieldData(data);
        Vue.nextTick(() => {
            assert.ok(connector.inputHandle === terminal);
        });
    });
});

QUnit.test("replacing terminal on data input destroys invalid connections", function (assert) {
    const node = this.node;
    node.inputs.push({ name: "TestName", extensions: ["txt"] });
    this.connectAttachedTerminal("txt", "txt", (connector) => {
        const connector_destroy_spy = sinon.spy(connector, "destroy");
        const data = {
            inputs: [{ name: "TestName", extensions: ["bam"] }],
            outputs: [],
        };
        node.updateFieldData(data);
        Vue.nextTick(() => {
            $(node.element).find(".input-terminal")[0].terminal;
            assert.ok(connector_destroy_spy.called);
        });
    });
});

QUnit.test("replacing terminal on data input with collection changes mapping view type", function (assert) {
    const node = this.node;
    node.inputs.push({ name: "TestName", extensions: ["txt"] });
    this.connectAttachedTerminal("txt", "txt", (connector) => {
        const connector_destroy_spy = sinon.spy(connector, "destroy");
        const data = {
            inputs: [{ name: "TestName", extensions: ["txt"], input_type: "dataset_collection" }],
            outputs: [],
        };
        node.updateFieldData(data);
        Vue.nextTick(() => {
            // Input type changed to dataset_collection - old connections are reset.
            // Would be nice to preserve these connections and make them map over.
            $(node.element).find(".input-terminal")[0].terminal;
            assert.ok(connector_destroy_spy.called);
        });
    });
});

QUnit.test("replacing terminal on data collection input with simple input changes mapping view type", function (
    assert
) {
    const node = this.node;
    node.inputs.push({ name: "TestName", extensions: ["txt"] });
    this.connectAttachedMappedOutput((connector) => {
        const connector_destroy_spy = sinon.spy(connector, "destroy");
        const data = {
            inputs: [{ name: "TestName", extensions: ["txt"], input_type: "dataset" }],
            outputs: [],
        };
        node.updateFieldData(data);
        Vue.nextTick(() => {
            $(node.element).find(".input-terminal")[0].terminal;
            assert.ok(connector_destroy_spy.called);
        });
    });
});

// global InputTerminalView
QUnit.module("Input terminal view", {
    beforeEach: function () {
        this.app = create_app();
        this.node = this.app.build_node("tool", "newnode");
        this.input = { name: "i1", extensions: "txt", multiple: false };
        this.node.updateFieldData({ inputs: [this.input], outputs: [] });
    },
});

QUnit.test("terminal added to node", function (assert) {
    assert.ok(this.node.inputTerminals.i1);
    assert.equal(this.node.inputTerminals.i1.datatypes, ["txt"]);
    assert.equal(this.node.inputTerminals.i1.multiple, false);
});

QUnit.test("terminal element", function (assert) {
    const dragging = new InputDragging(this.app, {
        node: this.node,
        input: this.input,
        el: document.createElement("div"),
        terminal: { on: () => {} },
    });
    assert.equal(dragging.el.tagName, "DIV");
});

QUnit.module("Output terminal view", {
    beforeEach: function () {
        this.app = create_app();
        this.node = this.app.build_node("tool", "newnode");
        this.output = { name: "o1", extensions: "txt" };
        this.node.updateFieldData({ inputs: [], outputs: [this.output] });
    },
});

QUnit.test("terminal added to node", function (assert) {
    assert.ok(this.node.outputTerminals.o1);
    assert.equal(this.node.outputTerminals.o1.datatypes, ["txt"]);
});

QUnit.test("terminal element", function (assert) {
    const dragging = new OutputDragging(this.app, {
        node: this.node,
        output: this.output,
        el: document.createElement("div"),
        terminal: { on: () => {} },
    });
    assert.equal(dragging.el.tagName, "DIV");
});

QUnit.module("CollectionTypeDescription", {
    listType: function () {
        return new Terminals.CollectionTypeDescription("list");
    },
    pairedType: function () {
        return new Terminals.CollectionTypeDescription("paired");
    },
    pairedListType: function () {
        return new Terminals.CollectionTypeDescription("list:paired");
    },
});

QUnit.test("canMatch", function (assert) {
    assert.ok(this.listType().canMatch(this.listType()));
    assert.ok(!this.listType().canMatch(this.pairedType()));
    assert.ok(!this.listType().canMatch(this.pairedListType()));
});

QUnit.test("canMatch special types", function (assert) {
    assert.ok(this.listType().canMatch(Terminals.ANY_COLLECTION_TYPE_DESCRIPTION));
    assert.ok(Terminals.ANY_COLLECTION_TYPE_DESCRIPTION.canMatch(this.pairedListType()));

    assert.ok(!this.listType().canMatch(Terminals.NULL_COLLECTION_TYPE_DESCRIPTION));
    assert.ok(!Terminals.NULL_COLLECTION_TYPE_DESCRIPTION.canMatch(this.pairedListType()));
});

QUnit.test("canMapOver", function (assert) {
    assert.ok(!this.listType().canMapOver(this.listType()));
    assert.ok(!this.listType().canMapOver(this.pairedType()));
    assert.ok(this.pairedListType().canMapOver(this.pairedType()));
    assert.ok(!this.listType().canMapOver(this.pairedListType()));
});

QUnit.test("canMapOver special types", function (assert) {
    assert.ok(!this.listType().canMapOver(Terminals.NULL_COLLECTION_TYPE_DESCRIPTION));
    assert.ok(!Terminals.NULL_COLLECTION_TYPE_DESCRIPTION.canMapOver(this.pairedListType()));

    // Following two should be able to be relaxed someday maybe - but the
    // tracking gets tricky I think. For now mapping only works for explicitly
    // defined collection types.
    assert.ok(!this.listType().canMapOver(Terminals.ANY_COLLECTION_TYPE_DESCRIPTION));
    assert.ok(!Terminals.ANY_COLLECTION_TYPE_DESCRIPTION.canMapOver(this.pairedListType()));
});

QUnit.test("append", function (assert) {
    var appendedType = this.listType().append(this.pairedType());
    assert.equal(appendedType.collectionType, "list:paired");
});

QUnit.test("isCollection", function (assert) {
    assert.ok(this.listType().isCollection);
    assert.ok(Terminals.ANY_COLLECTION_TYPE_DESCRIPTION.isCollection);
    assert.ok(!Terminals.NULL_COLLECTION_TYPE_DESCRIPTION.isCollection);
});

QUnit.test("equal", function (assert) {
    assert.ok(!this.listType().equal(this.pairedType()));
    assert.ok(this.listType().equal(this.listType()));

    assert.ok(Terminals.ANY_COLLECTION_TYPE_DESCRIPTION.equal(Terminals.ANY_COLLECTION_TYPE_DESCRIPTION));
    assert.ok(!Terminals.ANY_COLLECTION_TYPE_DESCRIPTION.equal(Terminals.NULL_COLLECTION_TYPE_DESCRIPTION));
    assert.ok(!Terminals.ANY_COLLECTION_TYPE_DESCRIPTION.equal(this.pairedType()));
    assert.ok(!this.pairedType().equal(Terminals.ANY_COLLECTION_TYPE_DESCRIPTION));

    assert.ok(Terminals.NULL_COLLECTION_TYPE_DESCRIPTION.equal(Terminals.NULL_COLLECTION_TYPE_DESCRIPTION));
    assert.ok(!Terminals.NULL_COLLECTION_TYPE_DESCRIPTION.equal(Terminals.ANY_COLLECTION_TYPE_DESCRIPTION));
    assert.ok(!Terminals.NULL_COLLECTION_TYPE_DESCRIPTION.equal(this.listType()));
    assert.ok(!this.listType().equal(Terminals.NULL_COLLECTION_TYPE_DESCRIPTION));
});

QUnit.test("default constructor", function (assert) {
    var terminal = new Terminals.InputTerminal({});
    assert.ok(terminal.mapOver === Terminals.NULL_COLLECTION_TYPE_DESCRIPTION);
});

QUnit.test("constructing with mapOver", function (assert) {
    var terminal = new Terminals.InputTerminal({
        mapOver: new Terminals.CollectionTypeDescription("list"),
    });
    assert.ok(terminal.mapOver.collectionType == "list");
});

QUnit.test("resetMapping", function (assert) {
    var terminal = new Terminals.InputTerminal({
        terminal: terminal,
        mapOver: new Terminals.CollectionTypeDescription("list"),
    });
    terminal.node = {
        hasMappedOverInputTerminals: () => true,
        inputTerminals: {},
        outputTerminals: {},
    };
    var changeSpy = sinon.spy();
    terminal.on("change", changeSpy);
    terminal.resetMapping();
    assert.ok(terminal.mapOver === Terminals.NULL_COLLECTION_TYPE_DESCRIPTION);
    assert.ok(changeSpy.called);
});

QUnit.module("terminal mapping logic", {
    newInputTerminal: function (mapOver, input, node) {
        input = input || {};
        node = node || this.newNode();
        if (!("extensions" in input)) {
            input["extensions"] = ["data"];
        }
        var inputEl = $("<div>")[0];
        const app = create_app();
        var inputTerminal = new Terminals.InputTerminal({ app: app, element: inputEl, input: input });
        inputTerminal.node = node;
        if (mapOver) {
            inputTerminal.setMapOver(new Terminals.CollectionTypeDescription(mapOver));
        }
        return inputTerminal;
    },
    newInputCollectionTerminal: function (input, node) {
        input = input || {};
        node = node || this.newNode();
        if (!("extensions" in input)) {
            input["extensions"] = ["data"];
        }
        const inputEl = $("<div>")[0];
        const app = create_app();
        const inputTerminal = new Terminals.InputCollectionTerminal({
            app: app,
            element: inputEl,
            input: input,
        });
        inputTerminal.node = node;
        return inputTerminal;
    },
    newOutputTerminal: function (mapOver, output, node) {
        output = output || {};
        node = node || this.newNode();
        if (!("extensions" in output)) {
            output["extensions"] = ["data"];
        }
        const outputEl = $("<div>")[0];
        const outputTerminal = new Terminals.OutputTerminal({ element: outputEl, datatypes: output.extensions });
        outputTerminal.node = node;
        if (mapOver) {
            outputTerminal.setMapOver(new Terminals.CollectionTypeDescription(mapOver));
        }
        return outputTerminal;
    },
    newOutputCollectionTerminal: function (collectionType, output, node, mapOver) {
        collectionType = collectionType || "list";
        output = output || {};
        node = node || this.newNode();
        if (!("extensions" in output)) {
            output["extensions"] = ["data"];
        }
        var outputEl = $("<div>")[0];
        var outputTerminal = new Terminals.OutputCollectionTerminal({
            element: outputEl,
            datatypes: output.extensions,
            collection_type: collectionType,
        });
        outputTerminal.node = node;
        if (mapOver) {
            outputTerminal.setMapOver(new Terminals.CollectionTypeDescription(mapOver));
        }
        return outputTerminal;
    },
    newNode: function () {
        var nodeEl = $("<div>")[0];
        var app = create_app();
        return new Node(app, { element: nodeEl });
    },
    _addExistingOutput: function (terminal, output, connected) {
        var self = this;
        var node = terminal.node;
        if (connected) {
            var inputTerminal = self.newInputTerminal();
            new Connector({}, inputTerminal, output);
        }
        this._addTerminalTo(output, node.outputTerminals);
        return output;
    },
    addOutput: function (terminal, connected) {
        var connectedOutput = this.newOutputTerminal();
        return this._addExistingOutput(terminal, connectedOutput, connected);
    },
    addCollectionOutput: function (terminal, connected) {
        var collectionOutput = this.newOutputCollectionTerminal();
        return this._addExistingOutput(terminal, collectionOutput, connected);
    },
    addConnectedOutput: function (terminal) {
        return this.addOutput(terminal, true);
    },
    addConnectedCollectionOutput: function (terminal) {
        var connectedOutput = this.newOutputCollectionTerminal();
        return this._addExistingOutput(terminal, connectedOutput, true);
    },
    addConnectedInput: function (terminal) {
        var self = this;
        var connectedInput = this.newInputTerminal();
        var node = terminal.node;
        var outputTerminal = self.newOutputTerminal();
        new Connector({}, connectedInput, outputTerminal);
        this._addTerminalTo(connectedInput, node.inputTerminals);
        return connectedInput;
    },
    _addTerminalTo: function (terminal, terminals) {
        var name = "other";
        while (name in terminals) {
            name += "_";
        }
        terminals[name] = terminal;
    },
    verifyNotAttachable: function (assert, inputTerminal, output) {
        var outputTerminal;
        if (typeof output == "string") {
            // Just given a collection type... create terminal out of it.
            outputTerminal = this.newOutputTerminal(output);
        } else {
            outputTerminal = output;
        }

        assert.ok(!inputTerminal.attachable(outputTerminal).canAccept);
    },
    verifyAttachable: function (assert, inputTerminal, output) {
        var outputTerminal;
        if (typeof output == "string") {
            // Just given a collection type... create terminal out of it.
            outputTerminal = this.newOutputTerminal(output);
        } else {
            outputTerminal = output;
        }

        assert.ok(
            inputTerminal.attachable(outputTerminal).canAccept,
            "Cannot attach " + outputTerminal + " to " + inputTerminal
        );

        // Go further... make sure datatypes are being enforced
        inputTerminal.datatypes = ["bam"];
        outputTerminal.datatypes = ["txt"];
        assert.ok(!inputTerminal.attachable(outputTerminal).canAccept);
    },
    verifyMappedOver: function (assert, terminal) {
        assert.ok(terminal.mapOver.isCollection);
    },
    verifyNotMappedOver: function (assert, terminal) {
        assert.ok(!terminal.mapOver.isCollection);
    },
});

QUnit.test("unconstrained input can be mapped over", function (assert) {
    this.inputTerminal1 = this.newInputTerminal();
    this.verifyAttachable(assert, this.inputTerminal1, "list");
});

QUnit.test("unmapped input can be mapped over if matching connected input terminals map type", function (assert) {
    this.inputTerminal1 = this.newInputTerminal();
    this.addConnectedInput(this.inputTerminal1);
    var connectedInput2 = this.addConnectedInput(this.inputTerminal1);
    connectedInput2.setMapOver(new Terminals.CollectionTypeDescription("list"));
    this.verifyAttachable(assert, this.inputTerminal1, "list");
});

QUnit.test("unmapped input cannot be mapped over if not matching connected input terminals map type", function (
    assert
) {
    this.inputTerminal1 = this.newInputTerminal();
    var connectedInput = this.addConnectedInput(this.inputTerminal1);
    connectedInput.setMapOver(new Terminals.CollectionTypeDescription("paired"));
    this.verifyNotAttachable(assert, this.inputTerminal1, "list");
});

QUnit.test(
    "unmapped input can be attached to by output collection if matching connected input terminals map type",
    function (assert) {
        this.inputTerminal1 = this.newInputTerminal();
        this.addConnectedInput(this.inputTerminal1);
        var connectedInput2 = this.addConnectedInput(this.inputTerminal1);
        connectedInput2.setMapOver(new Terminals.CollectionTypeDescription("list"));
        var outputTerminal = this.newOutputCollectionTerminal("list");
        this.verifyAttachable(assert, this.inputTerminal1, outputTerminal);
    }
);

QUnit.test(
    "unmapped input cannot be attached to by output collection if matching connected input terminals don't match map type",
    function (assert) {
        this.inputTerminal1 = this.newInputTerminal();
        this.addConnectedInput(this.inputTerminal1);
        var connectedInput2 = this.addConnectedInput(this.inputTerminal1);
        connectedInput2.setMapOver(new Terminals.CollectionTypeDescription("list"));
        var outputTerminal = this.newOutputCollectionTerminal("paired");
        this.verifyNotAttachable(assert, this.inputTerminal1, outputTerminal);
    }
);

QUnit.test(
    "unmapped input can be attached to by output collection if effective output type (output+mapover) is same as mapped over input",
    function (assert) {
        this.inputTerminal1 = this.newInputTerminal();
        this.addConnectedInput(this.inputTerminal1);
        var connectedInput2 = this.addConnectedInput(this.inputTerminal1);
        connectedInput2.setMapOver(new Terminals.CollectionTypeDescription("list:paired"));
        var outputTerminal = this.newOutputCollectionTerminal("paired");
        outputTerminal.setMapOver(new Terminals.CollectionTypeDescription("list"));
        this.verifyAttachable(assert, this.inputTerminal1, outputTerminal);
    }
);

QUnit.test(
    "unmapped input cannot be attached to by output collection if effective output type (output+mapover) is not same as mapped over input (1)",
    function (assert) {
        this.inputTerminal1 = this.newInputTerminal();
        this.addConnectedInput(this.inputTerminal1);
        var connectedInput2 = this.addConnectedInput(this.inputTerminal1);
        connectedInput2.setMapOver(new Terminals.CollectionTypeDescription("list:paired"));
        var outputTerminal = this.newOutputCollectionTerminal("list");
        outputTerminal.setMapOver(new Terminals.CollectionTypeDescription("list"));
        this.verifyNotAttachable(assert, this.inputTerminal1, outputTerminal);
    }
);

QUnit.test(
    "unmapped input cannot be attached to by output collection if effective output type (output+mapover) is not same as mapped over input (2)",
    function (assert) {
        this.inputTerminal1 = this.newInputTerminal();
        this.addConnectedInput(this.inputTerminal1);
        var connectedInput2 = this.addConnectedInput(this.inputTerminal1);
        connectedInput2.setMapOver(new Terminals.CollectionTypeDescription("list:paired"));
        var outputTerminal = this.newOutputCollectionTerminal("list");
        outputTerminal.setMapOver(new Terminals.CollectionTypeDescription("paired"));
        this.verifyNotAttachable(assert, this.inputTerminal1, outputTerminal);
    }
);

QUnit.test("unmapped input with unmapped, connected outputs cannot be mapped over", function (assert) {
    // It would invalidate the connections - someday maybe we could try to
    // recursively map over everything down the DAG - it would be expensive
    // to check that though.
    this.inputTerminal1 = this.newInputTerminal();
    this.addConnectedOutput(this.inputTerminal1);
    this.verifyNotAttachable(assert, this.inputTerminal1, "list");
});

QUnit.test("unmapped input with connected mapped outputs can be mapped over if matching", function (assert) {
    // It would invalidate the connections - someday maybe we could try to
    // recursively map over everything down the DAG - it would be expensive
    // to check that though.
    this.inputTerminal1 = this.newInputTerminal();
    var connectedOutput = this.addConnectedOutput(this.inputTerminal1);
    connectedOutput.setMapOver(new Terminals.CollectionTypeDescription("list"));
    this.verifyAttachable(assert, this.inputTerminal1, "list");
});

QUnit.test("unmapped input with connected mapped outputs cannot be mapped over if mapover not matching", function (
    assert
) {
    // It would invalidate the connections - someday maybe we could try to
    // recursively map over everything down the DAG - it would be expensive
    // to check that though.
    this.inputTerminal1 = this.newInputTerminal();
    var connectedOutput = this.addConnectedOutput(this.inputTerminal1);
    connectedOutput.setMapOver(new Terminals.CollectionTypeDescription("paired"));
    this.verifyNotAttachable(assert, this.inputTerminal1, "list");
});

QUnit.test("explicitly constrained input can not be mapped over by incompatible collection type", function (assert) {
    this.inputTerminal1 = this.newInputTerminal();
    this.inputTerminal1.setMapOver(new Terminals.CollectionTypeDescription("paired"));
    this.verifyNotAttachable(assert, this.inputTerminal1, "list");
});

QUnit.test("explicitly constrained input can be mapped over by compatible collection type", function (assert) {
    this.inputTerminal1 = this.newInputTerminal();
    this.inputTerminal1.setMapOver(new Terminals.CollectionTypeDescription("list"));
    this.verifyAttachable(assert, this.inputTerminal1, "list");
});

QUnit.test("unconstrained collection input can be mapped over", function (assert) {
    this.inputTerminal1 = this.newInputCollectionTerminal({ collection_types: ["paired"] });
    this.verifyAttachable(assert, this.inputTerminal1, "list:paired");
});

QUnit.test("unconstrained collection input cannot be mapped over by incompatible type", function (assert) {
    this.inputTerminal1 = this.newInputCollectionTerminal({ collection_types: ["list"] }); // Would need to be paired...
    this.verifyNotAttachable(assert, this.inputTerminal1, "list:paired");
});

QUnit.test("explicitly mapped over collection input can be attached by explicit mapping", function (assert) {
    this.inputTerminal1 = this.newInputCollectionTerminal({ collection_types: ["paired"] });
    this.inputTerminal1.setMapOver(new Terminals.CollectionTypeDescription("list"));
    this.verifyAttachable(assert, this.inputTerminal1, "list:paired");
});

QUnit.test("explicitly mapped over collection input can be attached by explicit mapping", function (assert) {
    this.inputTerminal1 = this.newInputCollectionTerminal({ collection_types: ["list:paired"] });
    this.inputTerminal1.setMapOver(new Terminals.CollectionTypeDescription("list"));
    // effectively input is list:list:paired so shouldn't be able to attach
    this.verifyNotAttachable(assert, this.inputTerminal1, "list:paired");
});

QUnit.test("unconnected multiple inputs can be connected to rank 1 collections", function (assert) {
    this.inputTerminal1 = this.newInputTerminal(null, { multiple: true });
    this.verifyAttachable(assert, this.inputTerminal1, "list");
});

QUnit.test("multiple input attachable by collections", function (assert) {
    this.inputTerminal1 = this.newInputTerminal(null, { multiple: true });
    var connectedInput1 = this.addConnectedInput(this.inputTerminal1);
    this.addConnectedOutput(connectedInput1);
    this.verifyAttachable(assert, this.inputTerminal1, "list");
});

QUnit.test("multiple input attachable by nested collections", function (assert) {
    this.inputTerminal1 = this.newInputTerminal(null, { multiple: true });
    var connectedInput1 = this.addConnectedInput(this.inputTerminal1);
    this.addConnectedOutput(connectedInput1);
    this.verifyAttachable(assert, this.inputTerminal1, "list:list");
});

QUnit.test("Multiple inputs cannot be connected to pairs", function (assert) {
    this.inputTerminal1 = this.newInputTerminal(null, { multiple: true });
    this.verifyNotAttachable(assert, this.inputTerminal1, "list:paired");
});

QUnit.test("resetMappingIfNeeded does nothing if not mapped", function (assert) {
    this.inputTerminal1 = this.newInputTerminal();
    this.inputTerminal1.resetMappingIfNeeded();
    this.verifyNotMappedOver(assert, this.inputTerminal1);
});

QUnit.test("resetMappingIfNeeded resets unconstrained input", function (assert) {
    this.inputTerminal1 = this.newInputTerminal("list");
    this.verifyMappedOver(assert, this.inputTerminal1);
    this.inputTerminal1.resetMappingIfNeeded();
    this.verifyNotMappedOver(assert, this.inputTerminal1);
});

QUnit.test("resetMappingIfNeeded does not reset if connected output depends on being mapped", function (assert) {
    this.inputTerminal1 = this.newInputTerminal("list");
    var connectedOutput = this.addConnectedOutput(this.inputTerminal1);
    connectedOutput.setMapOver(new Terminals.CollectionTypeDescription("list"));
    this.inputTerminal1.resetMappingIfNeeded();
    this.verifyMappedOver(assert, this.inputTerminal1);
});

QUnit.test("resetMappingIfNeeded resets if node outputs are not connected to anything", function (assert) {
    this.inputTerminal1 = this.newInputTerminal("list");
    var output = this.addOutput(this.inputTerminal1);
    output.setMapOver(new Terminals.CollectionTypeDescription("list"));
    this.inputTerminal1.resetMappingIfNeeded();
    this.verifyNotMappedOver(assert, this.inputTerminal1);
});

QUnit.test("resetMappingIfNeeded an input resets node outputs if they not connected to anything", function (assert) {
    this.inputTerminal1 = this.newInputTerminal("list");
    var output = this.addOutput(this.inputTerminal1);
    output.setMapOver(new Terminals.CollectionTypeDescription("list"));
    this.inputTerminal1.resetMappingIfNeeded();
    this.verifyNotMappedOver(assert, output);
});

QUnit.test("resetMappingIfNeeded an input resets node collection outputs if they not connected to anything", function (
    assert
) {
    this.inputTerminal1 = this.newInputTerminal("list");
    var output = this.addCollectionOutput(this.inputTerminal1);
    output.setMapOver(new Terminals.CollectionTypeDescription("list"));
    this.inputTerminal1.resetMappingIfNeeded();
    this.verifyNotMappedOver(assert, output);
});

QUnit.test("resetMappingIfNeeded resets if not last mapped over input", function (assert) {
    // Idea here is that other nodes are forcing output to still be mapped
    // over so don't need to disconnect output nodes.
    this.inputTerminal1 = this.newInputTerminal("list");
    var connectedInput1 = this.addConnectedInput(this.inputTerminal1);
    connectedInput1.setMapOver(new Terminals.CollectionTypeDescription("list"));
    var connectedOutput = this.addConnectedOutput(this.inputTerminal1);
    connectedOutput.setMapOver(new Terminals.CollectionTypeDescription("list"));
    this.inputTerminal1.resetMappingIfNeeded();
    // inputTerminal1 can be reset because connectedInput1
    // is still forcing connectedOutput to be mapped over,
    // so verify inputTerminal1 is rest and connectedInput1
    // and connectedOutput are untouched.
    this.verifyNotMappedOver(assert, this.inputTerminal1);
    this.verifyMappedOver(assert, connectedInput1);
    this.verifyMappedOver(assert, connectedOutput);
});

QUnit.test("simple mapping over collection outputs works correctly", function (assert) {
    this.inputTerminal1 = this.newInputTerminal();
    var connectedOutput = this.addConnectedCollectionOutput(this.inputTerminal1);
    this.inputTerminal1.setMapOver(new Terminals.CollectionTypeDescription("list"));

    // Can attach list output of collection type list that is being mapped
    // over another list to a list:list (because this is what it is) but not
    // to a list:list:list.
    var testTerminal2 = this.newInputTerminal("list:list");
    this.verifyAttachable(assert, testTerminal2, connectedOutput);

    var testTerminal1 = this.newInputTerminal("list:list:list");
    this.verifyNotAttachable(assert, testTerminal1, connectedOutput);
});
