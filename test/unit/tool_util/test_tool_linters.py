import pytest

from galaxy.tool_util.lint import LintContext
from galaxy.tool_util.linters import general, inputs, outputs
from galaxy.tool_util.parser.xml import XmlToolSource
from galaxy.util import etree


def lint_general(xml_tree, lint_ctx):
    """Wrap calling of lint_general to provide XmlToolSource argument.

    This allows general.lint_general to be called with the other linters which
    take an XmlTree as an argument.
    """
    tool_source = XmlToolSource(xml_tree)
    return general.lint_general(tool_source, lint_ctx)


NO_SECTIONS_XML = """
<tool name="BWA Mapper" id="bwa" version="1.0.1" is_multi_byte="true" display_interface="true" require_login="true" hidden="true">
    <description>The BWA Mapper</description>
    <version_command interpreter="python">bwa.py --version</version_command>
</tool>
"""

NO_WHEN_IN_CONDITIONAL_XML = """
<tool name="BWA Mapper" id="bwa" version="1.0.1" is_multi_byte="true" display_interface="true" require_login="true" hidden="true">
    <description>The BWA Mapper</description>
    <version_command interpreter="python">bwa.py --version</version_command>
    <inputs>
        <conditional name="labels">
            <param name="label_select" type="select" label="Points to label">
                <option value="none" selected="True">None</option>
            </param>
        </conditional>
    </inputs>
</tool>
"""

RADIO_SELECT_INCOMPATIBILITIES = """
<tool name="BWA Mapper" id="bwa" version="1.0.1" is_multi_byte="true" display_interface="true" require_login="true" hidden="true">
    <description>The BWA Mapper</description>
    <version_command interpreter="python">bwa.py --version</version_command>
    <inputs>
        <param name="radio_select" type="select" display="radio" optional="true" multiple="true">
            <option value="1">1</option>
            <option value="2">2</option>
        </param>
        <param name="radio_checkboxes" type="select" display="checkboxes" optional="false" multiple="false">
            <option value="1">1</option>
            <option value="2">2</option>
        </param>
    </inputs>
</tool>
"""

SELECT_DUPLICATED_OPTIONS = """
<tool name="BWA Mapper" id="bwa" version="1.0.1" is_multi_byte="true" display_interface="true" require_login="true" hidden="true">
    <description>The BWA Mapper</description>
    <version_command interpreter="python">bwa.py --version</version_command>
    <inputs>
        <param name="select" type="select" optional="true" multiple="true">
            <option value="v">x</option>
            <option value="v">x</option>
        </param>
    </inputs>
</tool>
"""

SELECT_DEPRECATIONS = """
<tool name="BWA Mapper" id="bwa" version="1.0.1" is_multi_byte="true" display_interface="true" require_login="true" hidden="true">
    <description>The BWA Mapper</description>
    <version_command interpreter="python">bwa.py --version</version_command>
    <inputs>
        <param name="select_do" type="select" dynamic_options="blah()"/>
        <param name="select_ff" type="select">
            <options from_file="file.tsv" transform_lines="narf()"/>
        </param>
        <param name="select_fp" type="select">
            <options from_parameter="select_do" options_filter_attribute="fasel"/>
        </param>
    </inputs>
</tool>
"""

SELECT_OPTION_DEFINITIONS = """
<tool name="BWA Mapper" id="bwa" version="1.0.1" is_multi_byte="true" display_interface="true" require_login="true" hidden="true">
    <description>The BWA Mapper</description>
    <version_command interpreter="python">bwa.py --version</version_command>
    <inputs>
        <param name="select_noopt" type="select"/>
        <param name="select_noopts" type="select">
            <options/>
        </param>
        <param name="select_fd_op" type="select">
            <options from_dataset="xyz"/>
            <options from_data_table="xyz"/>
            <option value="x">x</option>
        </param>
        <param name="select_fd_fdt" type="select">
            <options from_dataset="xyz" from_data_table="xyz"/>
        </param>
    </inputs>
</tool>
"""

WHITESPACE_IN_VERSIONS_AND_NAMES = """
<tool name=" BWA Mapper " id="bwa tool" version=" 1.0.1 " is_multi_byte="true" display_interface="true" require_login="true" hidden="true">
    <description>The BWA Mapper</description>
    <requirements>
        <requirement type="package" version=" 1.2.5 "> bwa </requirement>
    </requirements>
    <version_command interpreter="python">bwa.py --version</version_command>
    <inputs>
        <param name="select_fd_op" type="select">
            <options from_dataset="xyz"/>
            <options from_data_table="xyz"/>
            <option value="x">x</option>
        </param>
    </inputs>
</tool>
"""

VALIDATOR_INCOMPATIBILITIES = """
<tool name="BWA Mapper" id="bwa" version="1.0.1" is_multi_byte="true" display_interface="true" require_login="true" hidden="true">
    <description>The BWA Mapper</description>
    <version_command interpreter="python">bwa.py --version</version_command>
    <inputs>
        <param name="param_name" type="text">
            <validator type="in_range">TEXT</validator>
            <validator type="regex" filename="blah"/>
        </param>
    </inputs>
</tool>
"""

OUTPUTS_COLLECTION_FORMAT_SOURCE = """
<tool name="BWA Mapper" id="bwa" version="1.0.1" is_multi_byte="true" display_interface="true" require_login="true" hidden="true">
    <description>The BWA Mapper</description>
    <version_command interpreter="python">bwa.py --version</version_command>
    <outputs>
        <collection name="output_collection" type="paired">
            <data name="forward" format_source="input_readpair" />
            <data name="reverse" format_source="input_readpair" format="fastq"/>
        </collection>
    </outputs>
</tool>
"""

TESTS = [
    (
        NO_SECTIONS_XML, inputs.lint_inputs,
        lambda x:
            'Found no input parameters.' in x.warn_messages
            and len(x.warn_messages) == 1 and len(x.error_messages) == 0
    ),
    (
        NO_WHEN_IN_CONDITIONAL_XML, inputs.lint_inputs,
        lambda x:
            "Conditional [labels] no <when /> block found for select option 'none'" in x.warn_messages
            and len(x.warn_messages) == 1 and len(x.error_messages) == 0
    ),
    (
        RADIO_SELECT_INCOMPATIBILITIES, inputs.lint_inputs,
        lambda x:
            'Select [radio_select] display="radio" is incompatible with optional="true"' in x.error_messages
            and 'Select [radio_select] display="radio" is incompatible with multiple="true"' in x.error_messages
            and 'Select [radio_checkboxes] `display="checkboxes"` is incompatible with `optional="false"`, remove the `display` attribute' in x.error_messages
            and 'Select [radio_checkboxes] `display="checkboxes"` is incompatible with `multiple="false"`, remove the `display` attribute' in x.error_messages
            and len(x.warn_messages) == 0 and len(x.error_messages) == 4
    ),
    (
        SELECT_DUPLICATED_OPTIONS, inputs.lint_inputs,
        lambda x:
            'Select parameter [select] has multiple options with the same text content' in x.error_messages
            and 'Select parameter [select] has multiple options with the same value' in x.error_messages
            and len(x.warn_messages) == 0 and len(x.error_messages) == 2
    ),
    (
        SELECT_DEPRECATIONS, inputs.lint_inputs,
        lambda x:
            "Select parameter [select_do] uses deprecated 'dynamic_options' attribute." in x.warn_messages
            and "Select parameter [select_ff] options uses deprecated 'from_file' attribute." in x.warn_messages
            and "Select parameter [select_fp] options uses deprecated 'from_parameter' attribute." in x.warn_messages
            and "Select parameter [select_ff] options uses deprecated 'transform_lines' attribute." in x.warn_messages
            and "Select parameter [select_fp] options uses deprecated 'options_filter_attribute' attribute." in x.warn_messages
            and len(x.warn_messages) == 5 and len(x.error_messages) == 0
    ),
    (
        SELECT_OPTION_DEFINITIONS, inputs.lint_inputs,
        lambda x:
            "Select parameter [select_noopt] options have to be defined by either 'option' children elements, a 'options' element or the 'dynamic_options' attribute." in x.error_messages
            and "Select parameter [select_noopts] options tag defines no options. Use 'from_dataset', 'from_data_table', or a filter that adds values." in x.error_messages
            and "Select parameter [select_fd_op] options have to be defined by either 'option' children elements, a 'options' element or the 'dynamic_options' attribute." in x.error_messages
            and "Select parameter [select_fd_op] contains multiple options elements" in x.error_messages
            and "Select parameter [select_fd_fdt] options uses 'from_dataset' and 'from_data_table' attribute." in x.error_messages
            and len(x.warn_messages) == 0 and len(x.error_messages) == 5
    ),
    (
        WHITESPACE_IN_VERSIONS_AND_NAMES, lint_general,
        lambda x:
            "Tool version contains whitespace, this may cause errors: [ 1.0.1 ]." in x.warn_messages
            and "Tool name contains whitespace, this may cause errors: [ BWA Mapper ]." in x.warn_messages
            and "Requirement version contains whitespace, this may cause errors: [ 1.2.5 ]." in x.warn_messages
            and "Tool ID contains whitespace - this is discouraged: [bwa tool]."
            and len(x.warn_messages) == 4 and len(x.error_messages) == 0
    ),
    (
        VALIDATOR_INCOMPATIBILITIES, inputs.lint_inputs,
        lambda x:
            "Parameter [param_name]: 'in_range' validators are not expected to contain text (found 'TEXT')" in x.warn_messages
            and "Parameter [param_name]: validator with an incompatible type 'in_range'" in x.error_messages
            and "Parameter [param_name]: 'in_range' validators need to define the 'min' or 'max' attribute(s)" in x.error_messages
            and "Parameter [param_name]: attribute 'filename' is incompatible with validator of type 'regex'" in x.error_messages
            and "Parameter [param_name]: 'regex' validators need to define an 'expression' attribute" in x.error_messages
            and len(x.warn_messages) == 1 and len(x.error_messages) == 4
    ),
    (
        OUTPUTS_COLLECTION_FORMAT_SOURCE, outputs.lint_output,
        lambda x:
            "Tool data output reverse should use either format_source or format/ext" in x.warn_messages
            and len(x.warn_messages) == 1 and len(x.error_messages) == 0
    ),
]

TEST_IDS = [
    'Lint no sections',
    'lint no when',
    'radio select incompatibilities',
    'select duplicated options',
    'select deprecations',
    'select option definitions',
    'hazardous whitespace',
    'validator imcompatibilities',
    'outputs collection static elements with format_source'
]


@pytest.mark.parametrize('tool_xml,lint_func,assert_func', TESTS, ids=TEST_IDS)
def test_tool_xml(tool_xml, lint_func, assert_func):
    lint_ctx = LintContext('all')
    tree = etree.ElementTree(element=etree.fromstring(tool_xml))
    lint_ctx.lint(name="test_lint", lint_func=lint_func, lint_target=tree)
    assert assert_func(lint_ctx), (
        f"Warnings: {lint_ctx.warn_messages}\n"
        f"Errors: {lint_ctx.error_messages}"
    )
