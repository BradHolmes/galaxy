/**
 * Have to use a factory instead of something sane like a slot because
 * of the way VirtualList accepts its data-component parameter. It is annoying,
 * but the component works well, so I'm putting up with it for now.
 */

import VirtualList from "vue-virtual-scroll-list";
import ContentListMixin from "./mixins/ContentListMixin";

export const ContentListFactory = (ItemComponent) => ({
    mixins: [ ContentListMixin ],
    template: `
        <VirtualList class="vvsl"
            v-on="$listeners"
            v-bind="$attrs"
            :data-key="dataKey"
            :data-sources="contents"
            :data-component="itemComponent"
            :keeps="40"
            :estimate-size="38"
            wrap-tag="ul"
            item-tag="li"
            @scroll="(evt, { start, end }) => onScroll(start, end)"
            @tottop="onToTop"
            @tobottom="onToBottom"
            :top-threshold="20"
            :bottom-threshold="20"
        />
    `,
    components: {
        VirtualList,
    },
    computed: {
        itemComponent() {
            return ItemComponent;
        }
    },
    methods: {
        onToTop() {
            console.log("onToTop", ...arguments);
        },
        onToBottom() {
            console.log("onToBottom", ...arguments);
        }
    }
});
