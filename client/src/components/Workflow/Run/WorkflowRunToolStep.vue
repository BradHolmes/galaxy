<template>
    <div :step-label="model.step_label">
        <FormCard :title="model.fixed_title" icon="fa-wrench" :collapsible="true" :collapsed.sync="collapsed">
            <template v-slot:body>
                <FormMessage :message="errorText" variant="danger" :persistent="true" />
                <FormDisplay
                    :inputs="model.inputs"
                    :form-config="formConfig"
                    :sustain-repeats="true"
                    :sustain-conditionals="true"
                    :replace-params="replaceParams"
                    :validation-scroll-to="validationScrollTo"
                    @onChange="onChange"
                    @onValidation="onValidation"
                />
            </template>
        </FormCard>
    </div>
</template>

<script>
import _ from "underscore";
import FormDisplay from "components/Form/FormDisplay";
import FormMessage from "components/Form/FormMessage";
import FormCard from "components/Form/FormCard";
import { visitInputs } from "components/Form/utilities";
import { isDataStep } from "components/Workflow/Run/model";
import { getTool } from "./services";

export default {
    components: {
        FormDisplay,
        FormCard,
        FormMessage,
    },
    props: {
        model: {
            type: Object,
            required: true,
        },
        wpData: {
            type: Object,
            default: null,
        },
        stepData: {
            type: Object,
            default: null,
        },
        validationScrollTo: {
            type: Array,
            required: true,
        },
        historyId: {
            type: String,
            default: null,
        },
    },
    data() {
        return {
            collapsed: this.model.collapsed,
            formConfig: {},
            formData: {},
            replaceParams: {},
            errorText: null,
        };
    },
    watch: {
        stepData() {
            this.onReplaceParams();
        },
        wpData() {
            this.onReplaceParams();
        },
        validationScrollTo() {
            if (this.validationScrollTo.length > 0) {
                this.collapsed = false;
            }
        },
    },
    methods: {
        onReplaceParams() {
            const params = {};
            visitInputs(this.model.inputs, (input, name) => {
                params[name] = input;
            });
            this.replaceParams = {};
            _.each(params, (input, name) => {
                if (input.wp_linked || input.step_linked) {
                    let newValue;
                    if (input.step_linked) {
                        newValue = { values: [] };
                        _.each(input.step_linked, (sourceStep) => {
                            if (isDataStep(sourceStep)) {
                                const sourceData = this.stepData[sourceStep.index];
                                const value = sourceData && sourceData.input;
                                if (value) {
                                    _.each(value.values, (v) => {
                                        newValue.values.push(v);
                                    });
                                }
                            }
                        });
                        if (!input.multiple && newValue.values.length > 0) {
                            newValue = {
                                values: [newValue.values[0]],
                            };
                        }
                    }
                    if (input.wp_linked) {
                        newValue = input.value;
                        const re = /\$\{(.+?)\}/g;
                        let match;
                        while ((match = re.exec(input.value))) {
                            const wpValue = this.wpData[match[1]];
                            if (wpValue) {
                                newValue = newValue.split(match[0]).join(wpValue);
                            }
                        }
                    }
                    if (newValue !== undefined) {
                        this.replaceParams[name] = newValue;
                    }
                }
            });
        },
        onChange(data) {
            getTool(this.model.id, this.model.version, data, this.historyId).then(
                (formConfig) => {
                    this.formConfig = formConfig;
                },
                (errorText) => {
                    this.errorText = errorText;
                }
            );
            this.formData = data;
            this.$emit("onChange", this.model.index, data);
        },
        onValidation(validation) {
            this.$emit("onValidation", this.model.index, validation);
        },
    },
};
</script>
