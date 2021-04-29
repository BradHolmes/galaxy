# Test galaxy interactor

from packaging.version import Version

from galaxy_test.base.populators import skip_without_tool
from ._framework import ApiTestCase


class GalaxyInteractorBackwardCompatTestCase(ApiTestCase):

    def test_local_test_data_download(self):
        self.galaxy_interactor._target_galaxy_version = Version("18.09")
        assert self.galaxy_interactor.supports_test_data_download is False
        assert self.galaxy_interactor.test_data_download(tool_id='cat1', filename='1.bed').startswith(b'chr1\t147962192\t147962580')


class GalaxyInteractorTestCase(ApiTestCase):

    @skip_without_tool("multiple_versions")
    def test_new_version_has_loaded(self):
        # this test is redundant, it is just testing that new tool is loaded and the next test will break for the right reasons.  I'll remove this
        tool_id = "multiple_versions"
        tool_version = "0.1+galaxy6"
        tool_show_response = self._get("tools/%s" % tool_id, data={'tool_version': tool_version})
        self._assert_status_code_is(tool_show_response, 200)
        self.assertEqual(tool_show_response.json().get('version'), tool_version, msg="The new version has not loaded")

    @skip_without_tool("multiple_versions")
    def test_get_tool_tests(self):
        # test that get_tool_tests will return the right tests when the tool_version has a '+' in it
        test_data = self.galaxy_interactor.get_tool_tests(tool_id="multiple_versions", tool_version="0.1+galaxy6")
        print(test_data)
        assert isinstance(test_data, list)
        assert len(test_data) > 0
        assert isinstance(test_data[0], dict)
        assert test_data[0].get('tool_version') == "0.1+galaxy6"

        test_data = self.galaxy_interactor.get_tool_tests(tool_id="multiple_versions")  # test that tool_version=None does not break it
        assert isinstance(test_data, list)
        assert len(test_data) > 0
        assert isinstance(test_data[0], dict)
