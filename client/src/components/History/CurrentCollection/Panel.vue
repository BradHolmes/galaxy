<!-- When a dataset collection is being viewed, this panel shows the contents of that collection -->

<template>
    <DscProvider :is-root="isRoot" :debounce-period="500" :collection="selectedCollection" v-slot="{ dsc }">
        <CollectionContentProvider v-if="dsc" :parent="dsc" :debug="false" v-slot="{ loading, payload, setScrollPos }">
            <ExpandedItems
                :scope-key="selectedCollection.id"
                :get-item-key="(item) => item.type_id"
                v-slot="{ isExpanded, setExpanded }"
            >
                <Layout class="dataset-collection-panel">
                    <template v-slot:nav>
                        <TopNav :history="history" :selected-collections="selectedCollections" v-on="$listeners" />
                    </template>

                    <template v-slot:details>
                        <Details :dsc="dsc" :writable="writable" @update:dsc="updateDsc(dsc, $event)" />
                    </template>

                    <template v-slot:listing>
                        <Scroller
                            key-field="element_index"
                            :class="{ loadingBackground: loading }"
                            v-bind="payload"
                            @scroll="setScrollPos"
                        >
                            <template v-slot="{ item, index }">
                                <CollectionContentItem
                                    :item="item"
                                    :index="index"
                                    :expanded="isExpanded(item)"
                                    :writable="writable"
                                    @update:expanded="setExpanded(item, $event)"
                                    @viewCollection="$emit('viewCollection', item)"
                                />
                            </template>
                        </Scroller>
                    </template>
                </Layout>
            </ExpandedItems>
        </CollectionContentProvider>
    </DscProvider>
</template>

<script>
import { History } from "../model";
import { updateContentFields } from "../model/queries";
import { cacheContent } from "../caching";

import { DscProvider, CollectionContentProvider, ExpandedItems } from "../providers";
import Layout from "../Layout";
import TopNav from "./TopNav";
import Details from "./Details";
import Scroller from "../Scroller";
import { CollectionContentItem } from "../ContentItem";

import { reportPayload } from "../providers/ContentProvider/helpers";

export default {
    filters: {
        reportPayload,
    },
    components: {
        DscProvider,
        CollectionContentProvider,
        Layout,
        TopNav,
        Details,
        Scroller,
        CollectionContentItem,
        ExpandedItems,
    },
    props: {
        history: { type: History, required: true },
        selectedCollections: { type: Array, required: true },
    },
    computed: {
        selectedCollection() {
            const arr = this.selectedCollections;
            const selected = arr[arr.length - 1];
            return selected;
        },
        isRoot() {
            return this.selectedCollection == this.selectedCollections[0];
        },
        writable() {
            return this.isRoot;
        },
    },
    methods: {
        // change the data of the root collection, anything past the root
        // collection is part of the dataset collection, which i believe is supposed to
        // be immutable, so only edit name, tags, blah of top-level selected collection,

        async updateDsc(collection, fields) {
            // console.log("updateDsc", this.writable, collection, fields);
            if (this.writable) {
                const ajaxResult = await updateContentFields(collection, fields);
                await cacheContent({ ...collection, ...ajaxResult });
            }
        },
    },
};
</script>
