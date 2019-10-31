"""This module describes the :class:`ExplicitContainerResolver` ContainerResolver plugin."""
import logging

from ..container_resolvers import (
    ContainerResolver,
)
from ..requirements import ContainerDescription

log = logging.getLogger(__name__)


class ExplicitContainerResolver(ContainerResolver):
    """Find explicit containers referenced in the tool description (e.g. tool XML file) if present."""

    resolver_type = "explicit"

    def resolve(self, enabled_container_types, tool_info, **kwds):
        """Find a container explicitly mentioned in tool description.

        This ignores the tool requirements and assumes the tool author crafted
        a correct container.
        """
        for container_description in tool_info.container_descriptions:
            if self._container_type_enabled(container_description, enabled_container_types):
                return container_description

        return None


class FallbackContainerResolver(ContainerResolver):
    """Specify an explicit, identified container as a Docker container resolver."""

    resolver_type = "fallback"
    container_type = 'docker'

    def __init__(self, app_info=None, shell="/bin/bash", identifier="", **kwds):
        super(FallbackContainerResolver, self).__init__(app_info)
        self.shell = shell
        assert identifier, "fallback container resolver must be specified with non-empty identifier"
        self.identifier = identifier

    def _match(self, enabled_container_types, tool_info, container_description):
        if self._container_type_enabled(container_description, enabled_container_types):
            return True
        return False

    def resolve(self, enabled_container_types, tool_info, **kwds):
        container_description = ContainerDescription(
            self.identifier,
            type=self.container_type,
            shell=self.shell,
        )
        if self._match(enabled_container_types, tool_info, container_description):
            return container_description


class FallbackSingularityContainerResolver(FallbackContainerResolver):
    """Specify an explicit, identified container as a Singularity container resolver."""

    resolver_type = "fallback_singularity"
    container_type = 'singularity'


class FallbackNoRequirementsContainerResolver(FallbackContainerResolver):

    resolver_type = "fallback_no_requirements"

    def _match(self, enabled_container_types, tool_info, container_description):
        type_matches = super(FallbackNoRequirementsContainerResolver, self)._match(enabled_container_types, tool_info, container_description)
        return type_matches and (tool_info.requirements is None or len(tool_info.requirements) == 0)


class FallbackNoRequirementsSingularityContainerResolver(FallbackNoRequirementsContainerResolver):

    container_type = 'singularity'


class RequiresGalaxyEnvironmentContainerResolver(FallbackContainerResolver):

    resolver_type = "requires_galaxy_environment"

    def _match(self, enabled_container_types, tool_info, container_description):
        type_matches = super(RequiresGalaxyEnvironmentContainerResolver, self)._match(enabled_container_types, tool_info, container_description)
        return type_matches and tool_info.requires_galaxy_python_environment


class RequiresGalaxyEnvironmentSingularityContainerResolver(RequiresGalaxyEnvironmentContainerResolver):

    container_type = 'singularity'


class ExplicitSingularityContainerResolver(ExplicitContainerResolver):

    resolver_type = 'explicit_singularity'
    container_type = 'singularity'

    def resolve(self, enabled_container_types, tool_info, **kwds):
        """Find a container explicitly mentioned in tool description.

        This ignores the tool requirements and assumes the tool author crafted
        a correct container. We use singularity here to fetch docker containers,
        hence the container_description hack here.
        """
        for container_description in tool_info.container_descriptions:
            if container_description.type == 'docker':
                desc_dict = container_description.to_dict()
                desc_dict['type'] = self.container_type
                desc_dict['identifier'] = "docker://%s" % container_description.identifier
                container_description = container_description.from_dict(desc_dict)
            if self._container_type_enabled(container_description, enabled_container_types):
                return container_description

        return None


__all__ = (
    "ExplicitContainerResolver",
    "ExplicitSingularityContainerResolver",
    "FallbackContainerResolver",
    "FallbackSingularityContainerResolver",
    "FallbackNoRequirementsContainerResolver",
    "FallbackNoRequirementsSingularityContainerResolver",
    "RequiresGalaxyEnvironmentContainerResolver",
    "RequiresGalaxyEnvironmentSingularityContainerResolver",
)
