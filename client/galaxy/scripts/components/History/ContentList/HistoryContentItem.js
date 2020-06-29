import ContentItemMixin from "./ContentItemMixin";

export default {
    mixins: [ ContentItemMixin ],

    computed: {
        contentItemComponent() {
            if (this.scrolling) {
                return "Placeholder";
            }
            const { history_content_type } = this.source;
            switch (history_content_type) {
                case "dataset":
                    return "Dataset";
                case "dataset_collection":
                    return "DatasetCollection";
                default:
                    return "Placeholder";
            }
        },
    },
};